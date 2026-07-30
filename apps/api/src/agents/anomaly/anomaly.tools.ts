import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';

export function createAnomalyTools(prisma: PrismaService) {
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
      const where: any = { orderStatus: 'delivered' };

      if (dateFrom || dateTo) {
        where.orderPurchaseTimestamp = {};
        if (dateFrom) where.orderPurchaseTimestamp.gte = new Date(dateFrom);
        if (dateTo) where.orderPurchaseTimestamp.lte = new Date(dateTo);
      }

      if (categories && categories.length > 0) {
        where.items = {
          some: {
            product: {
              productCategoryName: { in: categories },
            },
          },
        };
      }

      if (interstateOnly || (sellerStates && sellerStates.length > 0) || (customerStates && customerStates.length > 0)) {
        const itemWhere: any = {};
        if (sellerStates && sellerStates.length > 0) {
          itemWhere.seller = { sellerState: { in: sellerStates } };
        }
        where.items = {
          some: {
            ...where.items?.some,
            ...itemWhere,
          },
        };
        if (customerStates && customerStates.length > 0) {
          where.customer = { customerState: { in: customerStates } };
        }
      }

      const orders = await prisma.olistOrder.findMany({
        where,
        select: {
          orderPurchaseTimestamp: true,
          orderDeliveredCustomerDate: true,
          orderEstimatedDeliveryDate: true,
          customer: { select: { customerState: true } },
          items: {
            select: {
              seller: { select: { sellerState: true } },
            },
            take: 1,
          },
        },
      });

      // If interstateOnly, filter strictly in memory if needed
      const filteredOrders = interstateOnly
        ? orders.filter((o) => {
            const sellerState = o.items[0]?.seller?.sellerState;
            const custState = o.customer?.customerState;
            return sellerState && custState && sellerState !== custState;
          })
        : orders;

      const totalSampleSize = filteredOrders.length;
      const appliedScope = {
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        categories: categories || null,
        sellerStates: sellerStates || null,
        customerStates: customerStates || null,
        interstateOnly: Boolean(interstateOnly),
        scopeHash,
      };

      if (totalSampleSize === 0) {
        return JSON.stringify({
          status: 'NO_DATA',
          reasonCode: 'NO_DELIVERED_ORDERS_IN_SCOPE',
          appliedScope,
          scopeHash,
          rowCount: 0,
          sampleSize: 0,
          data: null,
        });
      }

      const monthlyData: Record<string, { total: number; late: number }> = {};

      for (const o of filteredOrders) {
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
          status: 'INSUFFICIENT_DATA',
          reasonCode: 'MINIMUM_THREE_MONTHS_REQUIRED',
          appliedScope,
          scopeHash,
          rowCount: totalSampleSize,
          sampleSize: totalSampleSize,
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
        status: 'AVAILABLE',
        metric,
        method: 'ROBUST_Z_SCORE',
        threshold,
        appliedScope,
        scopeHash,
        rowCount: totalSampleSize,
        sampleSize: totalSampleSize,
        data: {
          totalMonths: monthlyRates.length,
          median: Math.round(median * 10) / 10,
          mad: Math.round(mad * 100) / 100,
          anomaliesDetected: anomaliesDetected.length,
          anomalies: anomaliesDetected,
          timeSeries: timeSeriesWithZScore,
        },
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
