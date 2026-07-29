import { ChatOpenAI } from '@langchain/openai';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';
import { createCustomerExperienceTools } from './cx.tools';

/**
 * Extracts a product category name from the user question if mentioned.
 * Olist categories are in Portuguese with underscores (e.g. informatica_acessorios, moveis_decoracao).
 */
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

  // Try partial match: extract anything that looks like a category from the question
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

    streaming.emit(investigationId, 'agent.started', {
      agent: 'CUSTOMER_EXPERIENCE',
    });

    const tools = createCustomerExperienceTools(prisma);
    const ratingTool = tools.find((t) => t.name === 'get_rating_summary')!;
    const searchTool = tools.find((t) => t.name === 'search_reviews_semantic')!;

    // Extract category from user question if present
    const detectedCategory = extractCategory(userQuestion);

    streaming.emit(investigationId, 'tool.started', {
      agent: 'CUSTOMER_EXPERIENCE',
      tool: 'get_rating_summary',
    });
    const ratingResult = await ratingTool.invoke({
      dateFrom: state.filters.dateFrom,
      dateTo: state.filters.dateTo,
      category: detectedCategory,
    });
    streaming.emit(investigationId, 'tool.completed', {
      agent: 'CUSTOMER_EXPERIENCE',
      tool: 'get_rating_summary',
    });

    streaming.emit(investigationId, 'tool.started', {
      agent: 'CUSTOMER_EXPERIENCE',
      tool: 'search_reviews_semantic',
    });
    const searchResult = await searchTool.invoke({
      query: userQuestion,
      topK: 3,
    });
    streaming.emit(investigationId, 'tool.completed', {
      agent: 'CUSTOMER_EXPERIENCE',
      tool: 'search_reviews_semantic',
    });

    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
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

Búsqueda semántica NLP de reseñas (SentenceTransformers 'all-MiniLM-L6-v2'):
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
    let description = 'Se evaluó la distribución de estrellas de los clientes.';
    let confidence = 0.94;

    try {
      const response = await model.invoke(prompt);
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

    const ratingEvidenceId = `ev-cx-rating-${Date.now()}`;
    const ratingEvidenceItem = {
      id: ratingEvidenceId,
      toolName: 'get_rating_summary',
      parameters: {
        dateFrom: state.filters.dateFrom,
        dateTo: state.filters.dateTo,
        category: detectedCategory,
      },
      resultSummary: ratingResult,
      generatedAt: new Date().toISOString(),
    };

    const semanticEvidenceId = `ev-cx-semantic-${Date.now()}`;
    const semanticEvidenceItem = {
      id: semanticEvidenceId,
      toolName: 'search_reviews_semantic',
      parameters: {
        query: userQuestion,
        topK: 3,
        model: 'paraphrase-multilingual-MiniLM-L12-v2',
      },
      resultSummary: searchResult,
      generatedAt: new Date().toISOString(),
    };

    const findingItem = {
      id: `finding-cx-${Date.now()}`,
      investigationId,
      agent: 'CUSTOMER_EXPERIENCE' as const,
      title,
      description,
      findingType: 'CUSTOMER_SATISFACTION',
      confidence,
      evidenceIds: [ratingEvidenceId, semanticEvidenceId],
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
      completedAgents: [
        ...state.completedAgents,
        'CUSTOMER_EXPERIENCE' as const,
      ],
      findings: [findingItem],
      evidence: [ratingEvidenceItem, semanticEvidenceItem],
    };
  };
}
