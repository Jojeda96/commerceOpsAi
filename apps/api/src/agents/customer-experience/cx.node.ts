import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';
import { createCustomerExperienceTools } from './cx.tools';
import {
  runAgentWithTrace,
  executeToolWithTrace,
} from '../../observability/agent-runner';
import {
  ToolExecutionTrace,
  Evidence,
  AnswerCoverageItem,
} from '@commerce-ops/shared-types';
import { createEvidenceFromToolEnvelope } from './cx-evidence-builder';
import { buildReviewComplaintFinding } from './build-review-complaint-finding';

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
    const {
      investigationId,
      userQuestion,
      analysisScope,
      requiredAnswerComponents = [],
    } = state;
    const iteration = state.iteration || 1;
    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const scopeHash = analysisScope?.scopeHash || 'global-scope';

    streaming.emit(investigationId, 'agent.started', {
      agent: 'CUSTOMER_EXPERIENCE',
    });

    const tools = createCustomerExperienceTools(prisma);
    const analyzeComplaintsTool = tools.find(
      (t) => t.name === 'analyze_review_complaints',
    )!;
    const ratingTool = tools.find((t) => t.name === 'get_rating_summary')!;
    const searchTool = tools.find((t) => t.name === 'search_reviews_semantic')!;
    const detectedCategory = extractCategory(userQuestion);

    const { result, trace: agentTrace } = await runAgentWithTrace({
      agentName: 'CUSTOMER_EXPERIENCE',
      iteration,
      modelName,
      execute: async ({ localRunId }) => {
        const toolTraces: ToolExecutionTrace[] = [];
        const evidenceItems: Evidence[] = [];

        // 1. Tool 1: Deterministic review complaint aggregation tool
        const complaintParams = {
          topics: ['DELIVERY_DELAY', 'PACKAGE_DAMAGE'],
          dateFrom: state.filters.dateFrom,
          dateTo: state.filters.dateTo,
          categories: detectedCategory
            ? [detectedCategory]
            : state.filters.categories,
          scopeHash,
        };

        streaming.emit(investigationId, 'tool.started', {
          agent: 'CUSTOMER_EXPERIENCE',
          tool: 'analyze_review_complaints',
        });

        const { result: rawComplaintResult, trace: complaintTrace } =
          await executeToolWithTrace({
            localAgentRunId: localRunId,
            agentName: 'CUSTOMER_EXPERIENCE',
            iteration,
            toolName: 'analyze_review_complaints',
            parameters: complaintParams,
            execute: () => analyzeComplaintsTool.invoke(complaintParams as any),
          });
        const complaintResultStr =
          typeof rawComplaintResult === 'string'
            ? rawComplaintResult
            : typeof (rawComplaintResult as any)?.content === 'string'
              ? (rawComplaintResult as any).content
              : JSON.stringify(rawComplaintResult);

        toolTraces.push(complaintTrace);

        streaming.emit(investigationId, 'tool.completed', {
          agent: 'CUSTOMER_EXPERIENCE',
          tool: 'analyze_review_complaints',
        });

        const complaintEvidence = createEvidenceFromToolEnvelope({
          id: `ev-cx-complaints-${Date.now()}`,
          localAgentRunId: localRunId,
          localToolExecutionId: complaintTrace.localExecutionId,
          agentName: 'CUSTOMER_EXPERIENCE',
          iteration,
          toolName: 'analyze_review_complaints',
          scopeHash,
          appliedScope: analysisScope,
          parameters: complaintParams,
          rawResultString: complaintResultStr,
        });
        evidenceItems.push(complaintEvidence);

        let parsedComplaintEnvelope: any = {};
        try {
          parsedComplaintEnvelope = JSON.parse(complaintResultStr);
        } catch (e) {
          console.warn('[CXNode] Failed to parse complaint envelope:', e);
        }

        // 2. Tool 2: get_rating_summary (optional or if required)
        let ratingEvidence: Evidence | undefined = undefined;
        if (requiredAnswerComponents.includes('REVIEW_RATING_CONTEXT')) {
          const ratingParams = {
            dateFrom: state.filters.dateFrom,
            dateTo: state.filters.dateTo,
            category: detectedCategory,
          };
          streaming.emit(investigationId, 'tool.started', {
            agent: 'CUSTOMER_EXPERIENCE',
            tool: 'get_rating_summary',
          });

          const { result: rawRatingResult, trace: ratingTrace } =
            await executeToolWithTrace({
              localAgentRunId: localRunId,
              agentName: 'CUSTOMER_EXPERIENCE',
              iteration,
              toolName: 'get_rating_summary',
              parameters: ratingParams,
              execute: () => ratingTool.invoke(ratingParams),
            });
          const ratingResultStr =
            typeof rawRatingResult === 'string'
              ? rawRatingResult
              : typeof (rawRatingResult as any)?.content === 'string'
                ? (rawRatingResult as any).content
                : JSON.stringify(rawRatingResult);

          toolTraces.push(ratingTrace);
          streaming.emit(investigationId, 'tool.completed', {
            agent: 'CUSTOMER_EXPERIENCE',
            tool: 'get_rating_summary',
          });

          ratingEvidence = createEvidenceFromToolEnvelope({
            id: `ev-cx-rating-${Date.now()}`,
            localAgentRunId: localRunId,
            localToolExecutionId: ratingTrace.localExecutionId,
            agentName: 'CUSTOMER_EXPERIENCE',
            iteration,
            toolName: 'get_rating_summary',
            scopeHash,
            appliedScope: analysisScope,
            parameters: ratingParams,
            rawResultString: ratingResultStr,
          });
          evidenceItems.push(ratingEvidence);
        }

        // 3. Optional semantic search enrichment
        const searchParams = {
          query: userQuestion,
          topK: 3,
          categories: detectedCategory
            ? [detectedCategory]
            : state.filters.categories,
          dateFrom: state.filters.dateFrom,
          dateTo: state.filters.dateTo,
        };

        try {
          const { result: rawSearchResult, trace: searchTrace } =
            await executeToolWithTrace({
              localAgentRunId: localRunId,
              agentName: 'CUSTOMER_EXPERIENCE',
              iteration,
              toolName: 'search_reviews_semantic',
              parameters: searchParams,
              execute: () => searchTool.invoke(searchParams),
            });
          const searchResultStr =
            typeof rawSearchResult === 'string'
              ? rawSearchResult
              : typeof (rawSearchResult as any)?.content === 'string'
                ? (rawSearchResult as any).content
                : JSON.stringify(rawSearchResult);

          toolTraces.push(searchTrace);

          const searchEvidence = createEvidenceFromToolEnvelope({
            id: `ev-cx-semantic-${Date.now()}`,
            localAgentRunId: localRunId,
            localToolExecutionId: searchTrace.localExecutionId,
            agentName: 'CUSTOMER_EXPERIENCE',
            iteration,
            toolName: 'search_reviews_semantic',
            scopeHash,
            appliedScope: analysisScope,
            parameters: searchParams,
            rawResultString: searchResultStr,
          });
          evidenceItems.push(searchEvidence);
        } catch (e) {
          console.warn(
            '[CXNode] Optional semantic search enrichment failed or skipped:',
            e,
          );
        }

        // 4. Build deterministic finding and coverage items
        const complaintData = parsedComplaintEnvelope.data || {
          taxonomyVersion: 'v1.0.0',
          method: 'DETERMINISTIC_LEXICON_AGGREGATION',
          totalCommentedReviews: 0,
          totalMatchedReviews: 0,
          topics: [],
        };

        const { finding, coverageItems } = buildReviewComplaintFinding({
          investigationId,
          localAgentRunId: localRunId,
          complaintData,
          complaintEvidence,
          ratingEvidence,
          requiredAnswerComponents,
        });

        streaming.emit(investigationId, 'finding.created', {
          agent: 'CUSTOMER_EXPERIENCE',
          finding,
        });
        streaming.emit(investigationId, 'agent.completed', {
          agent: 'CUSTOMER_EXPERIENCE',
        });

        return {
          result: {
            finding,
            evidence: evidenceItems,
            toolTraces,
            coverageItems,
          },
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
      answerCoverage: result.coverageItems,
    };
  };
}
