import { ChatOpenAI } from '@langchain/openai';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';
import { createCustomerExperienceTools } from './cx.tools';
import {
  runAgentWithTrace,
  executeToolWithTrace,
} from '../../observability/agent-runner';
import { extractModelUsage } from '../../observability/usage';
import { ToolExecutionTrace } from '@commerce-ops/shared-types';

function extractCategory(question: string): string | undefined {
  const categoryPatterns = [
    'informatica_acessorios',
    'moveis_decoracao',
    'beleza_saude',
    'esporte_lazer',
    'cama_mesa_banho',
    'utilidades_domesticas',
    'relogios_presentes',
    'telefonia',
    'automotivo',
    'brinquedos',
    'cool_stuff',
    'ferramentas_jardim',
    'perfumaria',
    'bebes',
    'eletronicos',
    'papelaria',
    'fashion_bolsas_e_acessorios',
    'pet_shop',
    'moveis_escritorio',
    'consoles_games',
    'malas_acessorios',
    'construcao_ferramentas',
    'eletrodomesticos',
    'livros_interesse_geral',
    'alimentos_bebidas',
    'musica',
    'moveis_sala',
    'climatizacao',
    'moveis_cozinha_area_de_servico_jantar_e_jardim',
    'watches_gifts',
    'computers_accessories',
    'furniture_decor',
    'health_beauty',
    'sports_leisure',
    'bed_bath_table',
    'housewares',
  ];

  const lower = question.toLowerCase().replace(/\s+/g, '_');
  for (const cat of categoryPatterns) {
    if (
      lower.includes(cat) ||
      question.toLowerCase().includes(cat.replace(/_/g, ' '))
    ) {
      return cat;
    }
  }

  const match = question.match(/categor[ií]a\s+([a-záéíóúñ_]+)/i);
  if (match) {
    return match[1].replace(/\s+/g, '_').toLowerCase();
  }

  return undefined;
}

export function createCustomerExperienceNode(
  prisma: PrismaService,
  streaming: StreamingService,
) {
  return async (state: CommerceOpsStateType) => {
    const { investigationId, userQuestion } = state;
    const iteration = state.iteration || 1;
    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    streaming.emit(investigationId, 'agent.started', {
      agent: 'CUSTOMER_EXPERIENCE',
    });

    const tools = createCustomerExperienceTools(prisma);
    const ratingTool = tools.find((t) => t.name === 'get_rating_summary')!;
    const searchTool = tools.find((t) => t.name === 'search_reviews_semantic')!;
    const detectedCategory = extractCategory(userQuestion);

    const { result, trace: agentTrace } = await runAgentWithTrace({
      agentName: 'CUSTOMER_EXPERIENCE',
      iteration,
      modelName,
      execute: async ({ localRunId }) => {
        const toolTraces: ToolExecutionTrace[] = [];
        const evidenceItems: any[] = [];

        // Tool 1: Rating summary
        const ratingParams = {
          dateFrom: state.filters.dateFrom,
          dateTo: state.filters.dateTo,
          category: detectedCategory,
        };
        streaming.emit(investigationId, 'tool.started', {
          agent: 'CUSTOMER_EXPERIENCE',
          tool: 'get_rating_summary',
        });

        const { result: ratingResult, trace: ratingTrace } =
          await executeToolWithTrace({
            localAgentRunId: localRunId,
            agentName: 'CUSTOMER_EXPERIENCE',
            iteration,
            toolName: 'get_rating_summary',
            parameters: ratingParams,
            execute: () => ratingTool.invoke(ratingParams),
          });
        toolTraces.push(ratingTrace);
        streaming.emit(investigationId, 'tool.completed', {
          agent: 'CUSTOMER_EXPERIENCE',
          tool: 'get_rating_summary',
        });

        evidenceItems.push({
          id: `ev-cx-rating-${Date.now()}`,
          localAgentRunId: localRunId,
          localToolExecutionId: ratingTrace.localExecutionId,
          sourceType: 'TOOL_EXECUTION' as const,
          agentName: 'CUSTOMER_EXPERIENCE' as const,
          iteration,
          toolName: 'get_rating_summary',
          parameters: ratingParams,
          resultSummary: ratingResult,
          generatedAt: new Date().toISOString(),
        });

        // Tool 2: Semantic review search
        const reviewScores =
          /1\s*estrella|una\s*estrella|baja\s*calificaci[oó]n|atraso|retraso/i.test(
            userQuestion,
          )
            ? [1, 2]
            : undefined;

        const searchParams = {
          query: userQuestion,
          topK: 5,
          reviewScores,
          categories: detectedCategory
            ? [detectedCategory]
            : state.filters.categories,
          dateFrom: state.filters.dateFrom,
          dateTo: state.filters.dateTo,
        };

        streaming.emit(investigationId, 'tool.started', {
          agent: 'CUSTOMER_EXPERIENCE',
          tool: 'search_reviews_semantic',
        });

        const { result: searchResult, trace: searchTrace } =
          await executeToolWithTrace({
            localAgentRunId: localRunId,
            agentName: 'CUSTOMER_EXPERIENCE',
            iteration,
            toolName: 'search_reviews_semantic',
            parameters: searchParams,
            execute: () => searchTool.invoke(searchParams),
          });
        toolTraces.push(searchTrace);
        streaming.emit(investigationId, 'tool.completed', {
          agent: 'CUSTOMER_EXPERIENCE',
          tool: 'search_reviews_semantic',
        });

        evidenceItems.push({
          id: `ev-cx-semantic-${Date.now()}`,
          localAgentRunId: localRunId,
          localToolExecutionId: searchTrace.localExecutionId,
          sourceType: 'TOOL_EXECUTION' as const,
          agentName: 'CUSTOMER_EXPERIENCE' as const,
          iteration,
          toolName: 'search_reviews_semantic',
          parameters: searchParams,
          resultSummary: searchResult,
          generatedAt: new Date().toISOString(),
        });

        let nlpMethodUsed = 'búsqueda semántica NLP';
        try {
          const parsedSearch = JSON.parse(searchResult);
          if (parsedSearch.method) nlpMethodUsed = parsedSearch.method;
        } catch (e) {
          console.warn('[CXNode] Error parseando searchResult:', e);
        }

        const model = new ChatOpenAI({
          modelName,
          temperature: 0.2,
          apiKey: process.env.OPENAI_API_KEY,
        });

        const categoryContext = detectedCategory
          ? `Categoría filtrada: "${detectedCategory}".`
          : 'Sin filtro de categoría (datos globales del dataset).';

        const prompt = `Eres el Customer Experience Agent de CommerceOps AI.
Pregunta del usuario: "${userQuestion}"
${categoryContext}

Métricas deterministas de satisfacción:
${ratingResult}

Búsqueda semántica de reseñas (Método: '${nlpMethodUsed}'):
${searchResult}

Genera un hallazgo técnico objetivo en formato JSON.
REGLAS OBLIGATORIAS:
- La descripción DEBE analizar la distribución de estrellas (1-5) Y TAMBIÉN citar directamente al menos 1 o 2 comentarios reales en portugués recuperados por la búsqueda semántica, indicando sus puntajes de similitud semántica.

Estructura JSON requerida:
{
  "title": "Análisis de satisfacción y búsqueda semántica de reseñas (NLP)",
  "description": "Análisis cuantitativo de estrellas y citas de reseñas recuperadas por similitud semántica...",
  "confidence": 0.94,
  "findingType": "CUSTOMER_SATISFACTION"
}`;

        let title = 'Análisis de satisfacción y calificaciones completado';
        let description =
          'Se evaluó la distribución de estrellas de los clientes.';
        let confidence = 0.94;
        let inputTokens: number | undefined;
        let outputTokens: number | undefined;

        try {
          const response = await model.invoke(prompt);
          const usage = extractModelUsage(response);
          inputTokens = usage.inputTokens;
          outputTokens = usage.outputTokens;

          const content =
            typeof response.content === 'string'
              ? response.content
              : JSON.stringify(response.content);
          const match = content.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.title) title = parsed.title;
            if (parsed.description) description = parsed.description;
            if (parsed.confidence) confidence = parsed.confidence;
          }
        } catch (err) {
          console.warn('[CXNode] Error executing LLM call:', err);
        }

        const findingItem = {
          id: `finding-cx-${Date.now()}`,
          investigationId,
          localAgentRunId: localRunId,
          agent: 'CUSTOMER_EXPERIENCE' as const,
          title,
          description,
          findingType: 'CUSTOMER_SATISFACTION',
          confidence,
          evidenceIds: evidenceItems.map((e) => e.id),
          operationalStatus: 'ACTIONABLE' as const,
          createdAt: new Date().toISOString(),
        };

        streaming.emit(investigationId, 'finding.created', {
          agent: 'CUSTOMER_EXPERIENCE',
          finding: findingItem,
        });
        streaming.emit(investigationId, 'agent.completed', {
          agent: 'CUSTOMER_EXPERIENCE',
        });

        return {
          result: {
            finding: findingItem,
            evidence: evidenceItems,
            toolTraces,
          },
          inputTokens,
          outputTokens,
        };
      },
    });

    return {
      completedAgents: [
        ...state.completedAgents,
        'CUSTOMER_EXPERIENCE' as const,
      ],
      agentRunTraces: [agentTrace],
      toolExecutionTraces: result.toolTraces,
      findings: [result.finding],
      evidence: result.evidence,
    };
  };
}
