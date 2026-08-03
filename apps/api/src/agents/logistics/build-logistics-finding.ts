import {
  AnalysisScope,
  Evidence,
  Finding,
  MethodClaim,
  NumericClaim,
} from '@commerce-ops/shared-types';
import { renderNumberWithClaim } from '../common/render-number';

export interface BuildLogisticsFindingParams {
  investigationId: string;
  localAgentRunId?: string;
  userQuestion: string;
  scope: AnalysisScope;
  aggregateEvidence: Evidence;
  routeEvidence?: Evidence;
  stageEvidence?: Evidence;
}

export function buildLogisticsFinding(
  params: BuildLogisticsFindingParams,
): Finding {
  const {
    investigationId,
    localAgentRunId,
    scope,
    aggregateEvidence,
    routeEvidence,
    stageEvidence,
  } = params;

  const numericClaims: NumericClaim[] = [];
  const methodClaims: MethodClaim[] = [
    {
      method: 'DESCRIPTIVE_AGGREGATION',
      evidenceId: aggregateEvidence.id,
      toolName: 'get_delivery_summary',
    },
  ];

  const evidenceIds: string[] = [aggregateEvidence.id];

  const aggData =
    typeof aggregateEvidence.resultSummary === 'string'
      ? JSON.parse(aggregateEvidence.resultSummary)
      : aggregateEvidence.resultSummary;

  const summaryData = aggData?.data || {};
  const deliveredOrders = summaryData.deliveredOrders || 0;
  const lateOrders = summaryData.lateOrders || 0;
  const aggregateLateRatePct = summaryData.aggregateLateRatePct || 0;

  const renderedDelivered = renderNumberWithClaim({
    metricKey: 'delivery.aggregate.delivered_orders',
    value: deliveredOrders,
    unit: 'COUNT',
    evidenceId: aggregateEvidence.id,
    sourcePath: '$.data.deliveredOrders',
    sampleSize: deliveredOrders,
  });
  numericClaims.push(renderedDelivered.claim);

  const renderedLate = renderNumberWithClaim({
    metricKey: 'delivery.aggregate.late_orders',
    value: lateOrders,
    unit: 'COUNT',
    evidenceId: aggregateEvidence.id,
    sourcePath: '$.data.lateOrders',
    sampleSize: deliveredOrders,
  });
  numericClaims.push(renderedLate.claim);

  const renderedRate = renderNumberWithClaim({
    metricKey: 'delivery.aggregate.late_rate_pct',
    value: aggregateLateRatePct,
    unit: 'PERCENT',
    evidenceId: aggregateEvidence.id,
    sourcePath: '$.data.aggregateLateRatePct',
    sampleSize: deliveredOrders,
    suffix: '%',
  });
  numericClaims.push(renderedRate.claim);

  const scopeLabel = scope.interstateOnly ? 'interestatales' : 'totales';
  let description = `En el periodo analizado se registraron ${renderedDelivered.renderedText} entregas ${scopeLabel}. De ellas, ${renderedLate.renderedText} llegaron tarde, equivalente a una tasa histórica agregada de ${renderedRate.renderedText}.`;

  if (routeEvidence && routeEvidence.resultSummary) {
    evidenceIds.push(routeEvidence.id);
    methodClaims.push({
      method: 'ROUTE_AGGREGATION',
      evidenceId: routeEvidence.id,
      toolName: 'get_delivery_performance_by_route',
    });

    const parsedRoute =
      typeof routeEvidence.resultSummary === 'string'
        ? JSON.parse(routeEvidence.resultSummary)
        : routeEvidence.resultSummary;
    const rData = parsedRoute?.data || {};

    if (rData && rData.eligibleRouteCount > 0) {
      const renderedRoutesCount = renderNumberWithClaim({
        metricKey: 'delivery.routes.eligible_route_count',
        value: rData.eligibleRouteCount,
        unit: 'COUNT',
        evidenceId: routeEvidence.id,
        sourcePath: '$.data.eligibleRouteCount',
        sampleSize: rData.eligibleRouteCount,
      });
      numericClaims.push(renderedRoutesCount.claim);

      const renderedUnweightedMean = renderNumberWithClaim({
        metricKey: 'delivery.routes.unweighted_mean_late_rate_pct',
        value: rData.unweightedMeanRouteLateRatePct,
        unit: 'PERCENT',
        evidenceId: routeEvidence.id,
        sourcePath: '$.data.unweightedMeanRouteLateRatePct',
        sampleSize: rData.eligibleRouteCount,
        suffix: '%',
      });
      numericClaims.push(renderedUnweightedMean.claim);

      const renderedMedian = renderNumberWithClaim({
        metricKey: 'delivery.routes.median_late_rate_pct',
        value: rData.medianRouteLateRatePct,
        unit: 'PERCENT',
        evidenceId: routeEvidence.id,
        sourcePath: '$.data.medianRouteLateRatePct',
        sampleSize: rData.eligibleRouteCount,
        suffix: '%',
      });
      numericClaims.push(renderedMedian.claim);

      description += ` Entre ${renderedRoutesCount.renderedText} rutas analizadas, el promedio simple de las tasas por ruta fue ${renderedUnweightedMean.renderedText} y la mediana fue ${renderedMedian.renderedText}. Estas métricas de distribución por ruta no equivalen a la proporción agregada de pedidos tardíos.`;
    }
  }

  if (stageEvidence && stageEvidence.resultSummary) {
    evidenceIds.push(stageEvidence.id);
    methodClaims.push({
      method: 'STAGE_BREAKDOWN',
      evidenceId: stageEvidence.id,
      toolName: 'get_delivery_stage_breakdown',
    });
  }

  const title = scope.interstateOnly
    ? 'Análisis histórico de entregas interestatales'
    : 'Análisis histórico de comportamiento logístico';

  return {
    id: `finding-logistics-${Date.now()}`,
    investigationId,
    localAgentRunId,
    agent: 'LOGISTICS',
    title,
    description,
    findingType: 'LOGISTICS_DELAY',
    evidenceIds,
    numericClaims,
    methodClaims,
    operationalStatus: 'ACTIONABLE',
    auditStatus: 'APPROVED',
    createdAt: new Date().toISOString(),
  };
}
