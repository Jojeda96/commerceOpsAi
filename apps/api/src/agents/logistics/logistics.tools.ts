import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';

export function createLogisticsTools(prisma: PrismaService) {
  const getDeliverySummary = tool(
    async ({
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
          some: { product: { productCategoryName: { in: categories } } },
        };
      }

      if (sellerStates && sellerStates.length > 0) {
        where.items = {
          ...where.items,
          some: {
            ...where.items?.some,
            seller: { sellerState: { in: sellerStates } },
          },
        };
      }

      if (customerStates && customerStates.length > 0) {
        where.customer = { customerState: { in: customerStates } };
      }

      const deliveredOrders = await prisma.olistOrder.findMany({
        where,
        select: {
          orderPurchaseTimestamp: true,
          orderDeliveredCustomerDate: true,
          orderEstimatedDeliveryDate: true,
          customer: { select: { customerState: true } },
          items: { select: { seller: { select: { sellerState: true } } }, take: 1 },
        },
      });

      const filteredOrders = interstateOnly
        ? deliveredOrders.filter((o) => {
            const sState = o.items[0]?.seller?.sellerState;
            const cState = o.customer?.customerState;
            return sState && cState && sState !== cState;
          })
        : deliveredOrders;

      const totalDelivered = filteredOrders.length;
      const appliedScope = {
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        categories: categories || null,
        sellerStates: sellerStates || null,
        customerStates: customerStates || null,
        interstateOnly: Boolean(interstateOnly),
        scopeHash,
      };

      if (totalDelivered === 0) {
        return JSON.stringify({
          status: 'NO_DATA',
          reasonCode: 'NO_DELIVERED_ORDERS_IN_SCOPE',
          appliedScope,
          scopeHash,
          rowCount: 0,
          sampleSize: 0,
          data: {
            deliveredOrders: 0,
            lateOrders: null,
            lateRatePct: null,
            averageDeliveryDays: null,
            averageDelayDays: null,
          },
        });
      }

      let lateOrdersCount = 0;
      let totalDeliveryDays = 0;
      let totalDelayDays = 0;

      for (const order of filteredOrders) {
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

      const lateRate = (lateOrdersCount / totalDelivered) * 100;
      const avgDeliveryDays = totalDeliveryDays / totalDelivered;
      const avgDelayDays = lateOrdersCount > 0 ? totalDelayDays / lateOrdersCount : 0;

      return JSON.stringify({
        status: 'AVAILABLE',
        appliedScope,
        scopeHash,
        rowCount: totalDelivered,
        sampleSize: totalDelivered,
        data: {
          deliveredOrders: totalDelivered,
          lateOrders: lateOrdersCount,
          lateRatePct: Math.round(lateRate * 10) / 10,
          averageDeliveryDays: Math.round(avgDeliveryDays * 10) / 10,
          averageDelayDays: Math.round(avgDelayDays * 10) / 10,
        },
      });
    },
    {
      name: 'get_delivery_summary',
      description:
        'Calcula métricas generales de entregas, tasa de atrasos (%) y días promedio dentro del AnalysisScope.',
      schema: z.object({
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

  const getDeliveryPerformanceByRoute = tool(
    async ({
      dateFrom,
      dateTo,
      categories,
      sellerState,
      customerState,
      interstateOnly = false,
      sortBy = 'lateRate',
      minOrders = 10,
      topN = 10,
      scopeHash = 'unspecified',
    }) => {
      const where: any = { orderStatus: 'delivered' };

      if (dateFrom || dateTo) {
        where.orderPurchaseTimestamp = {};
        if (dateFrom) where.orderPurchaseTimestamp.gte = new Date(dateFrom);
        if (dateTo) where.orderPurchaseTimestamp.lte = new Date(dateTo);
      }

      if (categories && categories.length > 0) {
        where.items = { some: { product: { productCategoryName: { in: categories } } } };
      }

      if (sellerState) {
        where.items = { ...where.items, some: { ...where.items?.some, seller: { sellerState } } };
      }
      if (customerState) {
        where.customer = { customerState };
      }

      const orders = await prisma.olistOrder.findMany({
        where,
        select: {
          orderPurchaseTimestamp: true,
          orderDeliveredCustomerDate: true,
          orderEstimatedDeliveryDate: true,
          customer: { select: { customerState: true } },
          items: { select: { seller: { select: { sellerState: true } } } },
        },
      });

      const routeMap: Record<
        string,
        { total: number; late: number; totalDays: number }
      > = {};

      for (const o of orders) {
        const sState = o.items[0]?.seller?.sellerState || 'OTHER';
        const cState = o.customer?.customerState || 'OTHER';

        if (interstateOnly && sState === cState) {
          continue;
        }

        const routeKey = `${sState}->${cState}`;
        if (!routeMap[routeKey]) routeMap[routeKey] = { total: 0, late: 0, totalDays: 0 };
        routeMap[routeKey].total += 1;

        if (o.orderDeliveredCustomerDate && o.orderPurchaseTimestamp) {
          const days =
            (o.orderDeliveredCustomerDate.getTime() -
              o.orderPurchaseTimestamp.getTime()) /
            (1000 * 3600 * 24);
          routeMap[routeKey].totalDays += days;
        }

        if (
          o.orderDeliveredCustomerDate &&
          o.orderEstimatedDeliveryDate &&
          o.orderDeliveredCustomerDate > o.orderEstimatedDeliveryDate
        ) {
          routeMap[routeKey].late += 1;
        }
      }

      const routes = Object.entries(routeMap)
        .map(([route, data]) => ({
          route,
          sampleSize: data.total,
          ordersCount: data.total,
          lateOrders: data.late,
          lateRatePct: Math.round((data.late / data.total) * 1000) / 10,
          avgDeliveryDays: Math.round((data.totalDays / data.total) * 10) / 10,
        }))
        .filter((r) => r.sampleSize >= minOrders)
        .sort((a, b) =>
          sortBy === 'lateRate'
            ? b.lateRatePct - a.lateRatePct
            : b.ordersCount - a.ordersCount,
        )
        .slice(0, topN);

      const totalSampleSize = orders.length;
      return JSON.stringify({
        status: routes.length > 0 ? 'AVAILABLE' : 'NO_DATA',
        appliedScope: {
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
          interstateOnly: Boolean(interstateOnly),
          scopeHash,
        },
        scopeHash,
        rowCount: totalSampleSize,
        sampleSize: totalSampleSize,
        routes,
      });
    },
    {
      name: 'get_delivery_performance_by_route',
      description:
        'Calcula el rendimiento de entregas y tasa de retraso por ruta (sellerState -> customerState) en el AnalysisScope.',
      schema: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        categories: z.array(z.string()).optional(),
        sellerState: z.string().optional(),
        customerState: z.string().optional(),
        interstateOnly: z.boolean().default(false),
        sortBy: z.enum(['lateRate', 'volume']).default('lateRate'),
        minOrders: z.number().default(10),
        topN: z.number().default(10),
        scopeHash: z.string(),
      }),
    },
  );

  const getDeliveryStageBreakdown = tool(
    async ({ dateFrom, dateTo, scopeHash = 'unspecified' }) => {
      const where: any = { orderStatus: 'delivered' };
      if (dateFrom || dateTo) {
        where.orderPurchaseTimestamp = {};
        if (dateFrom) where.orderPurchaseTimestamp.gte = new Date(dateFrom);
        if (dateTo) where.orderPurchaseTimestamp.lte = new Date(dateTo);
      }

      const orders = await prisma.olistOrder.findMany({
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
        if (
          o.orderPurchaseTimestamp &&
          o.orderDeliveredCarrierDate &&
          o.orderDeliveredCustomerDate
        ) {
          const prep =
            (o.orderDeliveredCarrierDate.getTime() -
              o.orderPurchaseTimestamp.getTime()) /
            (1000 * 3600 * 24);
          const transit =
            (o.orderDeliveredCustomerDate.getTime() -
              o.orderDeliveredCarrierDate.getTime()) /
            (1000 * 3600 * 24);
          if (prep >= 0 && transit >= 0) {
            totalPrepDays += prep;
            totalTransitDays += transit;
            count += 1;
          }
        }
      }

      if (count === 0) {
        return JSON.stringify({
          status: 'NO_DATA',
          scopeHash,
          rowCount: 0,
          sampleSize: 0,
          data: null,
        });
      }

      const avgPrep = totalPrepDays / count;
      const avgTransit = totalTransitDays / count;

      return JSON.stringify({
        status: 'AVAILABLE',
        scopeHash,
        rowCount: count,
        sampleSize: count,
        data: {
          analyzedOrders: count,
          avgSellerPreparationDays: Math.round(avgPrep * 10) / 10,
          avgCarrierTransitDays: Math.round(avgTransit * 10) / 10,
          totalCycleDays: Math.round((avgPrep + avgTransit) * 10) / 10,
          dominantStage:
            avgTransit > avgPrep ? 'CARRIER_TRANSIT' : 'SELLER_PREPARATION',
        },
      });
    },
    {
      name: 'get_delivery_stage_breakdown',
      description:
        'Desglosa los tiempos de entrega entre preparación del vendedor y tránsito del transportista en el AnalysisScope.',
      schema: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        scopeHash: z.string(),
      }),
    },
  );

  return [
    getDeliverySummary,
    getDeliveryPerformanceByRoute,
    getDeliveryStageBreakdown,
  ];
}
