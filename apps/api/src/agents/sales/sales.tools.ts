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

  return [getRevenueSummary, getSalesByCategory];
}
