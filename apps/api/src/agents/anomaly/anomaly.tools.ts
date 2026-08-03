import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';
import { DeliveryScopeRepository } from '../logistics/delivery-scope.repository';
import {
  AnalysisScope,
  EvidenceMetric,
  METRIC_LABELS,
} from '@commerce-ops/shared-types';

export function createAnomalyTools(prisma: PrismaService) {
  const scopeRepo = new DeliveryScopeRepository(prisma);

  const detectMetricAnomalies = tool(
    async ({
      metric = 'late_delivery_rate',
      threshold = 3.0,
      dateFrom,
      dateTo,
      categories,
      sellerStates,
      customerStates,
      interstateOnly = false,
      scopeHash = 'unspecified',
    }) => {
      const scope: AnalysisScope = {
        dateFrom,
        dateTo,
        categories,
        sellerStates,
        customerStates,
        interstateOnly: Boolean(interstateOnly),
        provenance: [],
        scopeHash,
      };

      const { orders, diagnostics } =
        await scopeRepo.getScopedDeliveredOrders(scope);
      const totalSampleSize = orders.length;

      if (totalSampleSize === 0) {
        return JSON.stringify({
          status: 'NO_DATA',
          reasonCode: 'NO_DELIVERED_ORDERS_IN_SCOPE',
          scopeHash,
          appliedScope: scope,
          rowCount: 0,
          sampleSize: 0,
          methods: ['ROBUST_Z_SCORE'],
          metrics: [],
          data: null,
          diagnostics,
        });
      }

      const monthlyData: Record<string, { total: number; late: number }> = {};
      for (const o of orders) {
        const month = o.purchaseTimestamp.toISOString().slice(0, 7); // YYYY-MM
        if (!monthlyData[month]) monthlyData[month] = { total: 0, late: 0 };
        monthlyData[month].total++;
        if (o.isLate) monthlyData[month].late++;
      }

      const MIN_MONTHLY_SAMPLE = 30;
      const allMonths = Object.entries(monthlyData);
      const excludedLowSampleMonths = allMonths.filter(
        ([_, d]) => d.total < MIN_MONTHLY_SAMPLE,
      ).length;

      const monthlyRates = allMonths
        .filter(([_, d]) => d.total >= MIN_MONTHLY_SAMPLE)
        .map(([month, d]) => ({
          month,
          lateRatePct: Math.round((d.late / d.total) * 1000) / 10,
          sampleSize: d.total,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      const updatedDiagnostics = {
        ...diagnostics,
        minimumMonthlySample: MIN_MONTHLY_SAMPLE,
        excludedLowSampleMonths,
        includedMonths: monthlyRates.length,
      };

      if (monthlyRates.length < 3) {
        return JSON.stringify({
          status: 'INSUFFICIENT_DATA',
          reasonCode: 'MINIMUM_THREE_MONTHS_REQUIRED',
          scopeHash,
          appliedScope: scope,
          rowCount: totalSampleSize,
          sampleSize: totalSampleSize,
          methods: ['ROBUST_Z_SCORE'],
          metrics: [],
          data: null,
          diagnostics: updatedDiagnostics,
        });
      }

      const rates = monthlyRates.map((m) => m.lateRatePct);
      const sorted = [...rates].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median =
        sorted.length % 2 !== 0
          ? sorted[mid]
          : (sorted[mid - 1] + sorted[mid]) / 2;

      const absoluteDeviations = rates.map((r) => Math.abs(r - median));
      const sortedDeviations = [...absoluteDeviations].sort((a, b) => a - b);
      const madMid = Math.floor(sortedDeviations.length / 2);
      const mad =
        sortedDeviations.length % 2 !== 0
          ? sortedDeviations[madMid]
          : (sortedDeviations[madMid - 1] + sortedDeviations[madMid]) / 2;

      const scaledMad = 1.4826 * mad;

      if (scaledMad === 0) {
        return JSON.stringify({
          status: 'INSUFFICIENT_DATA',
          reasonCode: 'ZERO_MAD_NO_VARIABILITY',
          scopeHash,
          appliedScope: scope,
          rowCount: totalSampleSize,
          sampleSize: totalSampleSize,
          methods: ['ROBUST_Z_SCORE'],
          metrics: [],
          data: null,
          diagnostics: updatedDiagnostics,
        });
      }

      const series = monthlyRates.map((m) => {
        const robustZScore = (m.lateRatePct - median) / scaledMad;
        const roundedZ = Math.round(robustZScore * 100) / 100;
        return {
          month: m.month,
          lateRatePct: m.lateRatePct,
          sampleSize: m.sampleSize,
          robustZScore: roundedZ,
          isAnomaly: Math.abs(roundedZ) >= threshold,
        };
      });

      const anomalies = series.filter((s) => s.isAnomaly);
      const medianMonthlyLateRatePct = Math.round(median * 10) / 10;
      const roundedMad = Math.round(mad * 100) / 100;

      const metrics: EvidenceMetric[] = [
        {
          key: 'anomaly.series.months_evaluated',
          label:
            METRIC_LABELS['anomaly.series.months_evaluated'] ||
            'Meses evaluados',
          value: monthlyRates.length,
          unit: 'COUNT',
          sampleSize: monthlyRates.length,
          sourcePath: '$.data.monthsEvaluated',
          aggregation: 'COUNT',
        },
        {
          key: 'anomaly.series.anomaly_count',
          label: 'Cantidad de anomalías',
          value: anomalies.length,
          unit: 'COUNT',
          sampleSize: monthlyRates.length,
          sourcePath: '$.data.anomalyCount',
          aggregation: 'COUNT',
        },
        {
          key: 'anomaly.series.threshold',
          label: METRIC_LABELS['anomaly.series.threshold'] || 'Umbral Z-Score',
          value: threshold,
          unit: 'ROBUST_Z_SCORE',
          sourcePath: '$.data.threshold',
        },
        {
          key: 'anomaly.series.median_monthly_late_rate_pct',
          label:
            METRIC_LABELS['anomaly.series.median_monthly_late_rate_pct'] ||
            'Mediana mensual',
          value: medianMonthlyLateRatePct,
          unit: 'PERCENT',
          sampleSize: monthlyRates.length,
          sourcePath: '$.data.medianMonthlyLateRatePct',
          aggregation: 'MEDIAN',
        },
        {
          key: 'anomaly.series.mad',
          label: METRIC_LABELS['anomaly.series.mad'] || 'MAD',
          value: roundedMad,
          unit: 'PERCENT',
          sampleSize: monthlyRates.length,
          sourcePath: '$.data.mad',
        },
      ];

      for (let i = 0; i < anomalies.length; i++) {
        const a = anomalies[i];
        metrics.push({
          key: `anomaly.point.${a.month}.late_rate_pct`,
          label: `Tasa atraso ${a.month}`,
          value: a.lateRatePct,
          unit: 'PERCENT',
          sampleSize: a.sampleSize,
          sourcePath: `$.data.anomalies[${i}].lateRatePct`,
        });
        metrics.push({
          key: `anomaly.point.${a.month}.sample_size`,
          label: `Muestra ${a.month}`,
          value: a.sampleSize,
          unit: 'COUNT',
          sampleSize: a.sampleSize,
          sourcePath: `$.data.anomalies[${i}].sampleSize`,
        });
        metrics.push({
          key: `anomaly.point.${a.month}.robust_z_score`,
          label: `Robust Z ${a.month}`,
          value: a.robustZScore,
          unit: 'ROBUST_Z_SCORE',
          sampleSize: a.sampleSize,
          sourcePath: `$.data.anomalies[${i}].robustZScore`,
          aggregation: 'ROBUST_Z_SCORE',
        });
      }

      return JSON.stringify({
        status: 'AVAILABLE',
        scopeHash,
        appliedScope: scope,
        rowCount: totalSampleSize,
        sampleSize: totalSampleSize,
        methods: ['ROBUST_Z_SCORE'],
        metrics,
        data: {
          method: 'ROBUST_Z_SCORE',
          threshold,
          monthsEvaluated: monthlyRates.length,
          medianMonthlyLateRatePct,
          mad: roundedMad,
          anomalyCount: anomalies.length,
          anomalies,
          series,
        },
        diagnostics: updatedDiagnostics,
      });
    },
    {
      name: 'detect_metric_anomalies',
      description:
        'Detecta desviaciones anómalas en series temporales mediante Z-Score robusto en el universo del AnalysisScope.',
      schema: z.object({
        metric: z.enum(['late_delivery_rate']).default('late_delivery_rate'),
        threshold: z.number().positive().default(3.0),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        categories: z.array(z.string()).optional(),
        sellerStates: z.array(z.string()).optional(),
        customerStates: z.array(z.string()).optional(),
        interstateOnly: z.boolean().default(false),
        scopeHash: z.string(),
      }),
    },
  );

  return [detectMetricAnomalies];
}
