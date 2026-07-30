import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';

export function createSalesTools(prisma: PrismaService) {
  const getRevenueSummary = tool(
    async ({ dateFrom, dateTo }) => {
      const where: any = {};
      if (dateFrom || dateTo) {
        where.orderPurchaseTimestamp = {};
        if (dateFrom) where.orderPurchaseTimestamp.gte = new Date(dateFrom);
        if (dateTo) where.orderPurchaseTimestamp.lte = new Date(dateTo);
      }

      const itemsAgg = await prisma.olistOrderItem.aggregate({
        _sum: { price: true, freightValue: true },
        _count: { id: true },
        where: { order: where },
      });

      const totalOrders = await prisma.olistOrder.count({ where });
      const revenue = Number(itemsAgg._sum.price || 0);
      const freightTotal = Number(itemsAgg._sum.freightValue || 0);
      const avgOrderValue =
        totalOrders > 0 ? (revenue + freightTotal) / totalOrders : 0;

      return JSON.stringify({
        revenue,
        freightTotal,
        totalOrders,
        totalItems: itemsAgg._count.id || 0,
        averageOrderValue: Math.round(avgOrderValue * 100) / 100,
      });
    },
    {
      name: 'get_revenue_summary',
      description:
        'Calcula el resumen de facturación, total de pedidos, costo de envío y ticket promedio.',
      schema: z.object({
        dateFrom: z
          .string()
          .optional()
          .describe('Fecha inicio en formato ISO (ej: 2018-02-01)'),
        dateTo: z
          .string()
          .optional()
          .describe('Fecha fin en formato ISO (ej: 2018-02-28)'),
      }),
    },
  );

  const getSalesByCategory = tool(
    async ({ dateFrom, dateTo, topN = 10 }) => {
      const where: any = {};
      if (dateFrom || dateTo) {
        where.order = { orderPurchaseTimestamp: {} };
        if (dateFrom)
          where.order.orderPurchaseTimestamp.gte = new Date(dateFrom);
        if (dateTo) where.order.orderPurchaseTimestamp.lte = new Date(dateTo);
      }

      const items = await prisma.olistOrderItem.findMany({
        where,
        select: {
          price: true,
          product: {
            select: { productCategoryName: true },
          },
        },
      });

      const catAgg: Record<string, { revenue: number; items: number }> = {};
      for (const item of items) {
        const cat = item.product?.productCategoryName || 'sin_categoria';
        if (!catAgg[cat]) catAgg[cat] = { revenue: 0, items: 0 };
        catAgg[cat].revenue += Number(item.price);
        catAgg[cat].items += 1;
      }

      const sorted = Object.entries(catAgg)
        .map(([category, data]) => ({
          category,
          revenue: Math.round(data.revenue * 100) / 100,
          items: data.items,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, topN);

      return JSON.stringify(sorted);
    },
    {
      name: 'get_sales_by_category',
      description:
        'Agrupa las ventas por categoría de producto ordenadas por mayores ingresos globales.',
      schema: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        topN: z.number().default(10),
      }),
    },
  );

  const getSalesByPaymentMethod = tool(
    async ({ dateFrom, dateTo }) => {
      const where: any = {};
      if (dateFrom || dateTo) {
        where.order = { orderPurchaseTimestamp: {} };
        if (dateFrom)
          where.order.orderPurchaseTimestamp.gte = new Date(dateFrom);
        if (dateTo) where.order.orderPurchaseTimestamp.lte = new Date(dateTo);
      }

      const payments = await prisma.olistOrderPayment.findMany({
        where,
        select: {
          paymentType: true,
          paymentValue: true,
          paymentInstallments: true,
        },
      });

      const agg: Record<
        string,
        { totalValue: number; count: number; totalInstallments: number }
      > = {};
      for (const p of payments) {
        const type = p.paymentType || 'other';
        if (!agg[type])
          agg[type] = { totalValue: 0, count: 0, totalInstallments: 0 };
        agg[type].totalValue += Number(p.paymentValue);
        agg[type].count += 1;
        agg[type].totalInstallments += p.paymentInstallments;
      }

      const results = Object.entries(agg).map(([paymentType, data]) => ({
        paymentType,
        totalValue: Math.round(data.totalValue * 100) / 100,
        transactionCount: data.count,
        avgPaymentValue: Math.round((data.totalValue / data.count) * 100) / 100,
        avgInstallments:
          Math.round((data.totalInstallments / data.count) * 10) / 10,
      }));

      return JSON.stringify(results);
    },
    {
      name: 'get_sales_by_payment_method',
      description:
        'Calcula el desglose de ventas por método de pago (credit_card, boleto, voucher, debit_card) y cuotas promedio.',
      schema: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }),
    },
  );

  const getAverageOrderValueTrend = tool(
    async ({ dateFrom, dateTo }) => {
      const where: any = {};
      if (dateFrom || dateTo) {
        where.orderPurchaseTimestamp = {};
        if (dateFrom) where.orderPurchaseTimestamp.gte = new Date(dateFrom);
        if (dateTo) where.orderPurchaseTimestamp.lte = new Date(dateTo);
      }

      const orders = await prisma.olistOrder.findMany({
        where,
        select: {
          orderPurchaseTimestamp: true,
          payments: { select: { paymentValue: true } },
        },
        orderBy: { orderPurchaseTimestamp: 'asc' },
      });

      const monthlyMap: Record<string, { totalValue: number; count: number }> =
        {};
      for (const o of orders) {
        const monthKey = o.orderPurchaseTimestamp.toISOString().substring(0, 7); // YYYY-MM
        const orderVal = o.payments.reduce(
          (sum, p) => sum + Number(p.paymentValue),
          0,
        );
        if (!monthlyMap[monthKey])
          monthlyMap[monthKey] = { totalValue: 0, count: 0 };
        monthlyMap[monthKey].totalValue += orderVal;
        monthlyMap[monthKey].count += 1;
      }

      const trend = Object.entries(monthlyMap).map(([month, data]) => ({
        month,
        ordersCount: data.count,
        totalRevenue: Math.round(data.totalValue * 100) / 100,
        avgOrderValue:
          Math.round((data.totalValue / (data.count || 1)) * 100) / 100,
      }));

      return JSON.stringify(trend);
    },
    {
      name: 'get_average_order_value_trend',
      description:
        'Calcula la tendencia mensual del ticket promedio (AOV) y volumen de ventas.',
      schema: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }),
    },
  );

  return [
    getRevenueSummary,
    getSalesByCategory,
    getSalesByPaymentMethod,
    getAverageOrderValueTrend,
  ];
}
