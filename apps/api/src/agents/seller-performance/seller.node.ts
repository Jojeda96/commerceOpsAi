import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';
import { createSellerPerformanceTools } from './seller.tools';
import {
  runAgentWithTrace,
  executeToolWithTrace,
} from '../../observability/agent-runner';
import {
  ToolExecutionTrace,
  Evidence,
  Finding,
  AnswerCoverageItem,
  NumericClaim,
  MethodClaim,
} from '@commerce-ops/shared-types';

export function createSellerPerformanceNode(
  prisma: PrismaService,
  streaming: StreamingService,
) {
  return async (state: CommerceOpsStateType) => {
    const { investigationId, userQuestion } = state;
    const iteration = state.iteration || 1;
    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    streaming.emit(investigationId, 'agent.started', {
      agent: 'SELLER_PERFORMANCE',
    });

    const tools = createSellerPerformanceTools(prisma);
    const topSellerTool = tools.find(
      (t) => t.name === 'get_top_seller_by_revenue',
    )!;
    const scorecardTool = tools.find((t) => t.name === 'get_seller_scorecard')!;

    const { result, trace: agentTrace } = await runAgentWithTrace({
      agentName: 'SELLER_PERFORMANCE',
      iteration,
      modelName,
      execute: async ({ localRunId }) => {
        const toolTraces: ToolExecutionTrace[] = [];
        const evidenceItems: Evidence[] = [];
        const numericClaims: NumericClaim[] = [];
        const methodClaims: MethodClaim[] = [];

        const scopeHash = state.analysisScope?.scopeHash || 'global-scope';

        let targetSellerId = state.filters?.sellerIds?.[0];
        let topSellerEvidence: Evidence | undefined;

        if (!targetSellerId) {
          const topSellerParams = { scopeHash };

          streaming.emit(investigationId, 'tool.started', {
            agent: 'SELLER_PERFORMANCE',
            tool: 'get_top_seller_by_revenue',
          });

          const { result: topRes, trace: topTrace } =
            await executeToolWithTrace({
              localAgentRunId: localRunId,
              agentName: 'SELLER_PERFORMANCE',
              iteration,
              toolName: 'get_top_seller_by_revenue',
              parameters: topSellerParams,
              execute: () => topSellerTool.invoke(topSellerParams),
            });
          toolTraces.push(topTrace);
          streaming.emit(investigationId, 'tool.completed', {
            agent: 'SELLER_PERFORMANCE',
            tool: 'get_top_seller_by_revenue',
          });

          const topStr =
            typeof topRes === 'string' ? topRes : JSON.stringify(topRes);

          const parsedTopEnvelope = JSON.parse(topStr);
          const topData = parsedTopEnvelope?.data || null;

          topSellerEvidence = {
            id: `ev-seller-top-${Date.now()}`,
            localAgentRunId: localRunId,
            localToolExecutionId: topTrace.localExecutionId,
            sourceType: 'TOOL_EXECUTION',
            agentName: 'SELLER_PERFORMANCE',
            iteration,
            toolName: 'get_top_seller_by_revenue',
            scopeHash,
            appliedScope: state.analysisScope,
            status: parsedTopEnvelope.status,
            reasonCode: parsedTopEnvelope.reasonCode,
            parameters: topSellerParams,
            resultSummary: topStr,
            rowCount: parsedTopEnvelope.rowCount || 0,
            sampleSize: parsedTopEnvelope.sampleSize || 0,
            metrics: parsedTopEnvelope.metrics || [],
            generatedAt: new Date().toISOString(),
          };
          evidenceItems.push(topSellerEvidence);

          if (topData?.sellerId) {
            targetSellerId = topData.sellerId;
          }

          methodClaims.push({
            method: 'SELLER_REVENUE_RANKING',
            evidenceId: topSellerEvidence.id,
            toolName: 'get_top_seller_by_revenue',
          });
        }

        // If still no targetSellerId, return UNAVAILABLE finding
        if (!targetSellerId) {
          const findingItem: Finding = {
            id: `finding-seller-${Date.now()}`,
            investigationId,
            localAgentRunId: localRunId,
            agent: 'SELLER_PERFORMANCE',
            agentName: 'SELLER_PERFORMANCE',
            title: 'Rendimiento y riesgo del vendedor líder',
            description:
              'No se encontró un vendedor con ventas suficientes en el scope analizado.',
            findingType: 'SELLER_PERFORMANCE',
            evidenceIds: topSellerEvidence ? [topSellerEvidence.id] : [],
            numericClaims: [],
            methodClaims,
            auditStatus: 'PENDING',
            operationalStatus: 'UNAVAILABLE',
            createdAt: new Date().toISOString(),
          };

          const coverageItems: AnswerCoverageItem[] = [
            {
              component: 'TOP_SELLER_IDENTIFICATION',
              status: 'NO_DATA_WITH_REASON',
              reasonCode: 'NO_SELLERS_WITH_REVENUE',
              evidenceIds: topSellerEvidence ? [topSellerEvidence.id] : [],
            },
            {
              component: 'SELLER_CUMULATIVE_PERFORMANCE',
              status: 'NO_DATA_WITH_REASON',
              reasonCode: 'NO_SELLERS_WITH_REVENUE',
              evidenceIds: topSellerEvidence ? [topSellerEvidence.id] : [],
            },
            {
              component: 'SELLER_OPERATIONAL_RISK',
              status: 'NO_DATA_WITH_REASON',
              reasonCode: 'NO_SELLERS_WITH_REVENUE',
              evidenceIds: topSellerEvidence ? [topSellerEvidence.id] : [],
            },
          ];

          return {
            result: {
              finding: findingItem,
              evidence: evidenceItems,
              toolTraces,
              coverageItems,
            },
          };
        }

        const scorecardParams = {
          sellerId: targetSellerId,
          scopeHash,
        };

        streaming.emit(investigationId, 'tool.started', {
          agent: 'SELLER_PERFORMANCE',
          tool: 'get_seller_scorecard',
        });

        const { result: scorecardResult, trace: scorecardTrace } =
          await executeToolWithTrace({
            localAgentRunId: localRunId,
            agentName: 'SELLER_PERFORMANCE',
            iteration,
            toolName: 'get_seller_scorecard',
            parameters: scorecardParams,
            execute: () => scorecardTool.invoke(scorecardParams),
          });
        toolTraces.push(scorecardTrace);
        streaming.emit(investigationId, 'tool.completed', {
          agent: 'SELLER_PERFORMANCE',
          tool: 'get_seller_scorecard',
        });

        const scorecardStr =
          typeof scorecardResult === 'string'
            ? scorecardResult
            : JSON.stringify(scorecardResult);

        const parsedScoreEnvelope = JSON.parse(scorecardStr);
        const sc = parsedScoreEnvelope?.data || {};

        const scorecardEvidence: Evidence = {
          id: `ev-seller-scorecard-${Date.now()}`,
          localAgentRunId: localRunId,
          localToolExecutionId: scorecardTrace.localExecutionId,
          sourceType: 'TOOL_EXECUTION',
          agentName: 'SELLER_PERFORMANCE',
          iteration,
          toolName: 'get_seller_scorecard',
          scopeHash,
          appliedScope: state.analysisScope,
          status: parsedScoreEnvelope.status,
          reasonCode: parsedScoreEnvelope.reasonCode,
          parameters: scorecardParams,
          resultSummary: scorecardStr,
          rowCount: parsedScoreEnvelope.rowCount || 0,
          sampleSize: parsedScoreEnvelope.sampleSize || 0,
          metrics: parsedScoreEnvelope.metrics || [],
          generatedAt: new Date().toISOString(),
        };
        evidenceItems.push(scorecardEvidence);

        methodClaims.push({
          method: 'SELLER_SCORECARD_AGGREGATION',
          evidenceId: scorecardEvidence.id,
          toolName: 'get_seller_scorecard',
        });

        const sellerId = sc.sellerId || targetSellerId || 'desconocido';
        const totalRevenue = Number(sc.totalRevenue || 0);
        const totalGmv = Number(sc.totalGmv || 0);
        const uniqueOrders = Number(sc.totalUniqueOrders || 0);
        const itemsSold = Number(sc.totalItemsSold || 0);
        const lateRate = Number(sc.lateRate || 0);
        const averageRating = Number(sc.averageRating || 0);
        const riskScore = sc.riskScore || 'LOW';

        const description =
          `Vendedor con mayores ventas: ${sellerId}\n` +
          `Ingresos acumulados: R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
          `GMV: R$ ${totalGmv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
          `Pedidos únicos: ${uniqueOrders}\n` +
          `Items vendidos: ${itemsSold}\n` +
          `Tasa de atraso: ${lateRate}%\n` +
          `Rating promedio: ${averageRating}\n` +
          `Riesgo operacional: ${riskScore}`;

        // NumericClaims: all sourcePaths point to $.data.*
        numericClaims.push({
          claimId: 'claim-seller-revenue',
          metricKey: 'seller.revenue',
          value: totalRevenue,
          unit: 'BRL',
          evidenceId: scorecardEvidence.id,
          sourcePath: '$.data.totalRevenue',
          tolerance: 0.01,
        });

        numericClaims.push({
          claimId: 'claim-seller-gmv',
          metricKey: 'seller.gmv',
          value: totalGmv,
          unit: 'BRL',
          evidenceId: scorecardEvidence.id,
          sourcePath: '$.data.totalGmv',
          tolerance: 0.01,
        });

        numericClaims.push({
          claimId: 'claim-seller-orders',
          metricKey: 'seller.unique_orders',
          value: uniqueOrders,
          unit: 'COUNT',
          evidenceId: scorecardEvidence.id,
          sourcePath: '$.data.totalUniqueOrders',
          tolerance: 0,
        });

        numericClaims.push({
          claimId: 'claim-seller-items',
          metricKey: 'seller.items_sold',
          value: itemsSold,
          unit: 'COUNT',
          evidenceId: scorecardEvidence.id,
          sourcePath: '$.data.totalItemsSold',
          tolerance: 0,
        });

        numericClaims.push({
          claimId: 'claim-seller-late-rate',
          metricKey: 'seller.late_rate_pct',
          value: lateRate,
          unit: 'PERCENT',
          evidenceId: scorecardEvidence.id,
          sourcePath: '$.data.lateRate',
          tolerance: 0.1,
        });

        numericClaims.push({
          claimId: 'claim-seller-rating',
          metricKey: 'seller.average_rating',
          value: averageRating,
          unit: 'SCORE',
          evidenceId: scorecardEvidence.id,
          sourcePath: '$.data.averageRating',
          tolerance: 0.01,
        });

        const findingItem: Finding = {
          id: `finding-seller-${Date.now()}`,
          investigationId,
          localAgentRunId: localRunId,
          agent: 'SELLER_PERFORMANCE',
          agentName: 'SELLER_PERFORMANCE',
          title: `Rendimiento Acumulado y Riesgo Operacional del Vendedor ${sellerId}`,
          description,
          findingType: 'SELLER_PERFORMANCE',
          evidenceIds: evidenceItems.map((e) => e.id),
          numericClaims,
          methodClaims,
          auditStatus: 'PENDING',
          createdAt: new Date().toISOString(),
        };

        const coverageItems: AnswerCoverageItem[] = [
          {
            component: 'TOP_SELLER_IDENTIFICATION',
            status: 'ANSWERED',
            evidenceIds: topSellerEvidence
              ? [topSellerEvidence.id]
              : [scorecardEvidence.id],
          },
          {
            component: 'SELLER_CUMULATIVE_PERFORMANCE',
            status: 'ANSWERED',
            evidenceIds: [scorecardEvidence.id],
          },
          {
            component: 'SELLER_OPERATIONAL_RISK',
            status: 'ANSWERED',
            evidenceIds: [scorecardEvidence.id],
          },
        ];

        streaming.emit(investigationId, 'finding.created', {
          agent: 'SELLER_PERFORMANCE',
          finding: findingItem,
        });
        streaming.emit(investigationId, 'agent.completed', {
          agent: 'SELLER_PERFORMANCE',
        });

        return {
          result: {
            finding: findingItem,
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
        'SELLER_PERFORMANCE' as const,
      ],
      agentRunTraces: [agentTrace],
      toolExecutionTraces: result.toolTraces,
      findings: [result.finding],
      evidence: result.evidence,
      answerCoverage: result.coverageItems,
    };
  };
}
