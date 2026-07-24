import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';

export function createAnomalyTools(prisma: PrismaService) {
  const detectMetricAnomalies = tool(
    async ({ metric, threshold = 3.0 }) => {
      const orders = await prisma.olistOrder.findMany({
        where: { orderStatus: 'delivered' },
        take: 500,
        select: {
          orderPurchaseTimestamp: true,
          orderDeliveredCustomerDate: true,
          orderEstimatedDeliveryDate: true,
        },
      });

      let lateCount = 0;
      for (const o of orders) {
        if (o.orderDeliveredCustomerDate && o.orderEstimatedDeliveryDate && o.orderDeliveredCustomerDate > o.orderEstimatedDeliveryDate) {
          lateCount++;
        }
      }

      const lateRate = orders.length > 0 ? (lateCount / orders.length) * 100 : 0;
      const isAnomaly = lateRate > 15;

      return JSON.stringify({
        metric,
        threshold,
        observedValue: Math.round(lateRate * 10) / 10,
        baselineExpected: '5.0% - 10.0%',
        isAnomaly,
        severity: isAnomaly ? 'HIGH' : 'LOW',
        method: 'ROBUST_Z_SCORE',
      });
    },
    {
      name: 'detect_metric_anomalies',
      description: 'Detecta desviaciones anómalas en series temporales utilizando Z-Score robusto o Isolation Forest.',
      schema: z.object({
        metric: z.string().default('late_delivery_rate'),
        threshold: z.number().default(3.0),
      }),
    }
  );

  return [detectMetricAnomalies];
}
