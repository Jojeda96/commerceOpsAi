import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';

export function createAnomalyTools(prisma: PrismaService) {
  const detectMetricAnomalies = tool(
    async ({
      metric = 'late_delivery_rate',
      threshold = 2.5,
      dateFrom,
      dateTo,
      category,
    }) => {
      const where: any = { orderStatus: 'delivered' };

      if (dateFrom || dateTo) {
        where.orderPurchaseTimestamp = {};
        if (dateFrom) where.orderPurchaseTimestamp.gte = new Date(dateFrom);
        if (dateTo) where.orderPurchaseTimestamp.lte = new Date(dateTo);
      }

      if (category) {
        where.items = {
          some: {
            product: {
              productCategoryName: { contains: category, mode: 'insensitive' },
            },
          },
        };
      }

      const orders = await prisma.olistOrder.findMany({
        where,
        select: {
          orderPurchaseTimestamp: true,
          orderDeliveredCustomerDate: true,
          orderEstimatedDeliveryDate: true,
        },
      });

      const monthlyData: Record<string, { total: number; late: number }> = {};

      for (const o of orders) {
        const month = o.orderPurchaseTimestamp.toISOString().slice(0, 7); // YYYY-MM
        if (!monthlyData[month]) monthlyData[month] = { total: 0, late: 0 };
        monthlyData[month].total++;

        if (
          o.orderDeliveredCustomerDate &&
          o.orderEstimatedDeliveryDate &&
          o.orderDeliveredCustomerDate > o.orderEstimatedDeliveryDate
        ) {
          monthlyData[month].late++;
        }
      }

      const monthlyRates = Object.entries(monthlyData)
        .filter(([_, d]) => d.total >= 3)
        .map(([month, d]) => ({
          month,
          rate: (d.late / d.total) * 100,
          sampleSize: d.total,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      if (monthlyRates.length < 3) {
        return JSON.stringify({
          metric,
          appliedFilters: {
            category: category || 'ALL',
            dateFrom: dateFrom || null,
            dateTo: dateTo || null,
          },
          error:
            'Datos insuficientes para análisis de series temporales con los filtros aplicados',
          monthsAvailable: monthlyRates.length,
          timeSeries: monthlyRates,
        });
      }

      const rates = monthlyRates.map((m) => m.rate);

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
      const timeSeriesWithZScore = monthlyRates.map((m) => {
        const robustZScore = scaledMad > 0 ? (m.rate - median) / scaledMad : 0;
        return {
          ...m,
          rate: Math.round(m.rate * 10) / 10,
          robustZScore: Math.round(robustZScore * 100) / 100,
          isAnomaly: Math.abs(robustZScore) > threshold,
        };
      });

      const anomaliesDetected = timeSeriesWithZScore.filter((a) => a.isAnomaly);

      return JSON.stringify({
        metric,
        appliedFilters: {
          category: category || 'ALL',
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
        },
        method: 'ROBUST_Z_SCORE',
        window: 'monthly',
        totalMonths: monthlyRates.length,
        median: Math.round(median * 10) / 10,
        mad: Math.round(mad * 100) / 100,
        threshold,
        anomaliesDetected: anomaliesDetected.length,
        anomalies: anomaliesDetected,
        timeSeries: timeSeriesWithZScore,
      });
    },
    {
      name: 'detect_metric_anomalies',
      description:
        'Detecta desviaciones anómalas en series temporales con soporte para filtros de categoría, rango de fechas y métrica configurable.',
      schema: z.object({
        metric: z.string().default('late_delivery_rate'),
        threshold: z.number().default(2.5),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        category: z.string().optional(),
      }),
    },
  );

  return [detectMetricAnomalies];
}
