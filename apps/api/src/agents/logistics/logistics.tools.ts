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

  const getDeliveryPredictionScenarios = tool(
    async ({ sellerState, customerState }) => {
      try {
        const orderItems = await prisma.olistOrderItem.findMany({
          take: 100,
          where: {
            ...(sellerState ? { seller: { sellerState } } : {}),
            ...(customerState ? { order: { customer: { customerState } } } : {}),
          },
          include: { product: true },
        });

        if (orderItems.length > 0) {
          const avgFreight = orderItems.reduce((acc, i) => acc + Number(i.freightValue || 0), 0) / orderItems.length;
          const avgPrice = orderItems.reduce((acc, i) => acc + Number(i.price || 0), 0) / orderItems.length;
          const avgWeight = orderItems.reduce((acc, i) => acc + Number(i.product?.productWeightG || 500), 0) / orderItems.length;

          return JSON.stringify({
            sellerState: sellerState || 'SP',
            customerState: customerState || 'RJ',
            freightValue: Math.round(avgFreight * 100) / 100,
            price: Math.round(avgPrice * 100) / 100,
            productWeightG: Math.round(avgWeight),
            itemCount: 1,
            sampleSize: orderItems.length,
          });
        }
      } catch (err) {
        console.warn('[LogisticsTools] Could not query scenarios from DB:', err);
      }

      return JSON.stringify({
        sellerState: sellerState || 'SP',
        customerState: customerState || 'RJ',
        freightValue: 35.5,
        price: 110.0,
        productWeightG: 650,
        itemCount: 1,
        sampleSize: 0,
      });
    },
    {
      name: 'get_delivery_prediction_scenarios',
      description: 'Prepara un escenario de datos reales desde PostgreSQL para predicción ML.',
      schema: z.object({
        sellerState: z.string().optional(),
        customerState: z.string().optional(),
      }),
    },
  );

  return [getDeliverySummary, getDeliveryPredictionScenarios];
}
