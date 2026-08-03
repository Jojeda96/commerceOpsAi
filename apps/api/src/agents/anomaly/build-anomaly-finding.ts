import {
  Evidence,
  Finding,
  MethodClaim,
  NumericClaim,
} from '@commerce-ops/shared-types';
import { renderNumberWithClaim } from '../common/render-number';

export interface BuildAnomalyFindingParams {
  investigationId: string;
  localAgentRunId?: string;
  evidence: Evidence;
}

export function buildAnomalyFinding(
  params: BuildAnomalyFindingParams,
): Finding {
  const { investigationId, localAgentRunId, evidence } = params;

  const numericClaims: NumericClaim[] = [];
  const methodClaims: MethodClaim[] = [
    {
      method: 'ROBUST_Z_SCORE',
      evidenceId: evidence.id,
      toolName: evidence.toolName || 'detect_metric_anomalies',
    },
  ];

  const parsed =
    typeof evidence.resultSummary === 'string'
      ? JSON.parse(evidence.resultSummary)
      : evidence.resultSummary;

  const data = parsed?.data || {};
  const monthsEvaluated = data.monthsEvaluated || 0;
  const threshold = data.threshold || 3.0;
  const medianMonthlyLateRatePct = data.medianMonthlyLateRatePct || 0;
  const mad = data.mad || 0;
  const anomalies = data.anomalies || [];

  const renderedMonths = renderNumberWithClaim({
    metricKey: 'anomaly.series.months_evaluated',
    value: monthsEvaluated,
    unit: 'COUNT',
    evidenceId: evidence.id,
    sourcePath: '$.data.monthsEvaluated',
    sampleSize: monthsEvaluated,
  });
  numericClaims.push(renderedMonths.claim);

  const renderedThreshold = renderNumberWithClaim({
    metricKey: 'anomaly.series.threshold',
    value: threshold,
    unit: 'ROBUST_Z_SCORE',
    evidenceId: evidence.id,
    sourcePath: '$.data.threshold',
  });
  numericClaims.push(renderedThreshold.claim);

  const renderedMedian = renderNumberWithClaim({
    metricKey: 'anomaly.series.median_monthly_late_rate_pct',
    value: medianMonthlyLateRatePct,
    unit: 'PERCENT',
    evidenceId: evidence.id,
    sourcePath: '$.data.medianMonthlyLateRatePct',
    sampleSize: monthsEvaluated,
    suffix: '%',
  });
  numericClaims.push(renderedMedian.claim);

  const renderedMad = renderNumberWithClaim({
    metricKey: 'anomaly.series.mad',
    value: mad,
    unit: 'PERCENT',
    evidenceId: evidence.id,
    sourcePath: '$.data.mad',
    sampleSize: monthsEvaluated,
  });
  numericClaims.push(renderedMad.claim);

  let description = `Se evaluaron ${renderedMonths.renderedText} meses mediante Robust Z-Score, usando un umbral absoluto de ${renderedThreshold.renderedText}. La mediana mensual fue ${renderedMedian.renderedText} y el MAD fue ${renderedMad.renderedText}.`;

  if (anomalies.length > 0) {
    const anomalyParts = anomalies.map((anom: any, idx: number) => {
      const renderedRate = renderNumberWithClaim({
        metricKey: `anomaly.point.${anom.month}.late_rate_pct`,
        value: anom.lateRatePct,
        unit: 'PERCENT',
        evidenceId: evidence.id,
        sourcePath: `$.data.anomalies[${idx}].lateRatePct`,
        sampleSize: anom.sampleSize,
        suffix: '%',
      });
      numericClaims.push(renderedRate.claim);

      const renderedSample = renderNumberWithClaim({
        metricKey: `anomaly.point.${anom.month}.sample_size`,
        value: anom.sampleSize,
        unit: 'COUNT',
        evidenceId: evidence.id,
        sourcePath: `$.data.anomalies[${idx}].sampleSize`,
        sampleSize: anom.sampleSize,
      });
      numericClaims.push(renderedSample.claim);

      const renderedZ = renderNumberWithClaim({
        metricKey: `anomaly.point.${anom.month}.robust_z_score`,
        value: anom.robustZScore,
        unit: 'ROBUST_Z_SCORE',
        evidenceId: evidence.id,
        sourcePath: `$.data.anomalies[${idx}].robustZScore`,
        sampleSize: anom.sampleSize,
      });
      numericClaims.push(renderedZ.claim);

      return `${anom.month} presentó una tasa de ${renderedRate.renderedText} (${renderedSample.renderedText} pedidos, Z robusto = ${renderedZ.renderedText})`;
    });

    description += ` Se detectaron los siguientes picos anómalos: ${anomalyParts.join('; ')}.`;
  } else {
    description +=
      ' No se detectaron picos anómalos que superaran el umbral de Z-Score robusto.';
  }

  return {
    id: `finding-anomaly-${Date.now()}`,
    investigationId,
    localAgentRunId,
    agent: 'ANOMALY',
    title: 'Detección de anomalías mensuales mediante Robust Z-Score',
    description,
    findingType: 'ANOMALY_DETECTION',
    evidenceIds: [evidence.id],
    numericClaims,
    methodClaims,
    operationalStatus: 'ACTIONABLE',
    auditStatus: 'APPROVED',
    createdAt: new Date().toISOString(),
  };
}
