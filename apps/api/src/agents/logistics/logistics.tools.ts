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
          take: 200,
          where: {
            ...(sellerState ? { seller: { sellerState } } : {}),
            ...(customerState ? { order: { customer: { customerState } } } : {}),
          },
          include: { product: true, order: { include: { customer: true } }, seller: true },
        });

        if (orderItems.length > 0) {
          const avgFreight = orderItems.reduce((acc, i) => acc + Number(i.freightValue || 0), 0) / orderItems.length;
          const avgPrice = orderItems.reduce((acc, i) => acc + Number(i.price || 0), 0) / orderItems.length;
          const avgWeight = orderItems.reduce((acc, i) => acc + Number(i.product?.productWeightG || 500), 0) / orderItems.length;
          const sampleSellerState = sellerState || orderItems[0].seller?.sellerState || 'SP';
          const sampleCustomerState = customerState || orderItems[0].order?.customer?.customerState || 'RJ';

          return JSON.stringify({
            status: 'AVAILABLE',
            sellerState: sampleSellerState,
            customerState: sampleCustomerState,
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
        status: 'UNAVAILABLE',
        reason: 'NO_DATABASE_SCENARIOS_FOUND',
        sellerState: sellerState || 'SP',
        customerState: customerState || 'RJ',
        sampleSize: 0,
      });
    },
    {
      name: 'get_delivery_prediction_scenarios',
      description: 'Consulta escenarios de rutas e ítems reales desde PostgreSQL para inferencia ML.',
      schema: z.object({
        sellerState: z.string().optional(),
        customerState: z.string().optional(),
      }),
    },
  );

  const getDeliveryPerformanceByRoute = tool(
    async ({ sellerState, customerState, topN = 10 }) => {
      const where: any = { orderStatus: 'delivered' };
      if (sellerState) {
        where.items = { some: { seller: { sellerState } } };
      }
      if (customerState) {
        where.customer = { customerState };
      }

      const orders = await prisma.olistOrder.findMany({
        take: 300,
        where,
        select: {
          orderPurchaseTimestamp: true,
          orderDeliveredCustomerDate: true,
          orderEstimatedDeliveryDate: true,
          customer: { select: { customerState: true } },
          items: { select: { seller: { select: { sellerState: true } } } },
        },
      });

      const routeMap: Record<string, { total: number; late: number; totalDays: number }> = {};
      for (const o of orders) {
        const sState = o.items[0]?.seller?.sellerState || 'OTHER';
        const cState = o.customer?.customerState || 'OTHER';
        const routeKey = `${sState}->${cState}`;

        if (!routeMap[routeKey]) routeMap[routeKey] = { total: 0, late: 0, totalDays: 0 };
        routeMap[routeKey].total += 1;

        if (o.orderDeliveredCustomerDate && o.orderPurchaseTimestamp) {
          const days = (o.orderDeliveredCustomerDate.getTime() - o.orderPurchaseTimestamp.getTime()) / (1000 * 3600 * 24);
          routeMap[routeKey].totalDays += days;
        }

        if (o.orderDeliveredCustomerDate && o.orderEstimatedDeliveryDate && o.orderDeliveredCustomerDate > o.orderEstimatedDeliveryDate) {
          routeMap[routeKey].late += 1;
        }
      }

      const routes = Object.entries(routeMap)
        .map(([route, data]) => ({
          route,
          ordersCount: data.total,
          lateOrders: data.late,
          lateRate: Math.round((data.late / data.total) * 1000) / 10,
          avgDeliveryDays: Math.round((data.totalDays / data.total) * 10) / 10,
        }))
        .sort((a, b) => b.ordersCount - a.ordersCount)
        .slice(0, topN);

      return JSON.stringify(routes);
    },
    {
      name: 'get_delivery_performance_by_route',
      description: 'Calcula el rendimiento de entregas y tasa de retraso por ruta interestatal/intraestatal (sellerState -> customerState).',
      schema: z.object({
        sellerState: z.string().optional(),
        customerState: z.string().optional(),
        topN: z.number().default(10),
      }),
    },
  );

  const getDeliveryStageBreakdown = tool(
    async ({ dateFrom, dateTo }) => {
      const where: any = { orderStatus: 'delivered' };
      if (dateFrom || dateTo) {
        where.orderPurchaseTimestamp = {};
        if (dateFrom) where.orderPurchaseTimestamp.gte = new Date(dateFrom);
        if (dateTo) where.orderPurchaseTimestamp.lte = new Date(dateTo);
      }

      const orders = await prisma.olistOrder.findMany({
        take: 300,
        where,
        select: {
          orderPurchaseTimestamp: true,
          orderDeliveredCarrierDate: true,
          orderDeliveredCustomerDate: true,
        },
      });

      let totalPrepDays = 0;
      let totalTransitDays = 0;
      let count = 0;

      for (const o of orders) {
        if (o.orderPurchaseTimestamp && o.orderDeliveredCarrierDate && o.orderDeliveredCustomerDate) {
          const prep = (o.orderDeliveredCarrierDate.getTime() - o.orderPurchaseTimestamp.getTime()) / (1000 * 3600 * 24);
          const transit = (o.orderDeliveredCustomerDate.getTime() - o.orderDeliveredCarrierDate.getTime()) / (1000 * 3600 * 24);
          if (prep >= 0 && transit >= 0) {
            totalPrepDays += prep;
            totalTransitDays += transit;
            count += 1;
          }
        }
      }

      const avgPrep = count > 0 ? totalPrepDays / count : 0;
      const avgTransit = count > 0 ? totalTransitDays / count : 0;

      return JSON.stringify({
        analyzedOrders: count,
        avgSellerPreparationDays: Math.round(avgPrep * 10) / 10,
        avgCarrierTransitDays: Math.round(avgTransit * 10) / 10,
        totalCycleDays: Math.round((avgPrep + avgTransit) * 10) / 10,
        dominantStage: avgTransit > avgPrep ? 'CARRIER_TRANSIT' : 'SELLER_PREPARATION',
      });
    },
    {
      name: 'get_delivery_stage_breakdown',
      description: 'Desglosa los tiempos de entrega entre preparación del vendedor y tránsito del transportista.',
      schema: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }),
    },
  );

  return [
    getDeliverySummary,
    getDeliveryPredictionScenarios,
    getDeliveryPerformanceByRoute,
    getDeliveryStageBreakdown,
  ];
}
