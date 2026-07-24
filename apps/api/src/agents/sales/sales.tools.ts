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
      const revenue = itemsAgg._sum.price || 0;
      const freightTotal = itemsAgg._sum.freightValue || 0;
      const avgOrderValue = totalOrders > 0 ? (revenue + freightTotal) / totalOrders : 0;

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
      description: 'Calcula el resumen de facturación, total de pedidos, costo de envío y ticket promedio.',
      schema: z.object({
        dateFrom: z.string().optional().describe('Fecha inicio en formato ISO (ej: 2018-02-01)'),
        dateTo: z.string().optional().describe('Fecha fin en formato ISO (ej: 2018-02-28)'),
      }),
    }
  );

  const getSalesByCategory = tool(
    async ({ dateFrom, dateTo, topN = 10 }) => {
      const where: any = {};
      if (dateFrom || dateTo) {
        where.order = { orderPurchaseTimestamp: {} };
        if (dateFrom) where.order.orderPurchaseTimestamp.gte = new Date(dateFrom);
        if (dateTo) where.order.orderPurchaseTimestamp.lte = new Date(dateTo);
      }

      const categoryItems = await prisma.olistOrderItem.groupBy({
        by: ['productId'],
        _sum: { price: true },
        _count: { id: true },
        where,
        orderBy: {
          _sum: { price: 'desc' },
        },
        take: topN * 5,
      });

      const productIds = categoryItems.map((i) => i.productId);
      const products = await prisma.olistProduct.findMany({
        where: { id: { in: productIds } },
        select: { id: true, productCategoryName: true },
      });

      const prodMap = new Map<string, string>();
      for (const p of products) {
        prodMap.set(p.id, p.productCategoryName || 'sin_categoria');
      }

      const catAgg: Record<string, { revenue: number; items: number }> = {};
      for (const item of categoryItems) {
        const cat = prodMap.get(item.productId) || 'sin_categoria';
        if (!catAgg[cat]) catAgg[cat] = { revenue: 0, items: 0 };
        catAgg[cat].revenue += item._sum.price || 0;
        catAgg[cat].items += item._count.id || 0;
      }

      const sorted = Object.entries(catAgg)
        .map(([category, data]) => ({ category, revenue: data.revenue, items: data.items }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, topN);

      return JSON.stringify(sorted);
    },
    {
      name: 'get_sales_by_category',
      description: 'Agrupa las ventas por categoría de producto ordenadas por mayores ingresos.',
      schema: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        topN: z.number().default(10),
      }),
    }
  );

  return [getRevenueSummary, getSalesByCategory];
}
