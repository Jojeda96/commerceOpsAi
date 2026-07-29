import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';

export function createLogisticsTools(prisma: PrismaService) {
  const getDeliverySummary = tool(
    async ({ dateFrom, dateTo }) => {
      const where: any = { orderStatus: 'delivered' };
      if (dateFrom || dateTo) {
        where.orderPurchaseTimestamp = {};
        if (dateFrom) where.orderPurchaseTimestamp.gte = new Date(dateFrom);
        if (dateTo) where.orderPurchaseTimestamp.lte = new Date(dateTo);
      }

      const deliveredOrders = await prisma.olistOrder.findMany({
        where,
        select: {
          orderPurchaseTimestamp: true,
          orderDeliveredCustomerDate: true,
          orderEstimatedDeliveryDate: true,
        },
      });

      let lateOrdersCount = 0;
      let totalDeliveryDays = 0;
      let totalDelayDays = 0;

      for (const order of deliveredOrders) {
        if (order.orderDeliveredCustomerDate && order.orderPurchaseTimestamp) {
          const delDays =
            (order.orderDeliveredCustomerDate.getTime() -
              order.orderPurchaseTimestamp.getTime()) /
            (1000 * 3600 * 24);
          totalDeliveryDays += delDays;

          if (
            order.orderEstimatedDeliveryDate &&
            order.orderDeliveredCustomerDate > order.orderEstimatedDeliveryDate
          ) {
            lateOrdersCount++;
            const delayDays =
              (order.orderDeliveredCustomerDate.getTime() -
                order.orderEstimatedDeliveryDate.getTime()) /
              (1000 * 3600 * 24);
            totalDelayDays += delayDays;
          }
        }
      }

      const totalDelivered = deliveredOrders.length;
      const lateRate =
        totalDelivered > 0 ? (lateOrdersCount / totalDelivered) * 100 : 0;
      const avgDeliveryDays =
        totalDelivered > 0 ? totalDeliveryDays / totalDelivered : 0;
      const avgDelayDays =
        lateOrdersCount > 0 ? totalDelayDays / lateOrdersCount : 0;

      return JSON.stringify({
        deliveredOrders: totalDelivered,
        lateOrders: lateOrdersCount,
        lateRate: Math.round(lateRate * 10) / 10,
        averageDeliveryDays: Math.round(avgDeliveryDays * 10) / 10,
        averageDelayDays: Math.round(avgDelayDays * 10) / 10,
      });
    },
    {
      name: 'get_delivery_summary',
      description:
        'Calcula métricas generales de entregas, tasa de atrasos (%) y días promedio de demora.',
      schema: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }),
    },
  );

  return [getDeliverySummary];
}
