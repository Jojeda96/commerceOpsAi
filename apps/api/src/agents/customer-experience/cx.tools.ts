import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';

export function createCustomerExperienceTools(prisma: PrismaService) {
  const getRatingSummary = tool(
    async ({ dateFrom, dateTo, category }) => {
      const where: any = {};

      // Filtro por fecha
      if (dateFrom || dateTo) {
        where.order = { orderPurchaseTimestamp: {} };
        if (dateFrom) where.order.orderPurchaseTimestamp.gte = new Date(dateFrom);
        if (dateTo) where.order.orderPurchaseTimestamp.lte = new Date(dateTo);
      }

      // Filtro por categoría de producto
      if (category) {
        if (!where.order) where.order = {};
        where.order.items = {
          some: {
            product: {
              productCategoryName: {
                contains: category,
                mode: 'insensitive',
              },
            },
          },
        };
      }

      const agg = await prisma.olistOrderReview.aggregate({
        _avg: { reviewScore: true },
        _count: { id: true },
        where,
      });

      const dist = await prisma.olistOrderReview.groupBy({
        by: ['reviewScore'],
        _count: { id: true },
        where,
      });

      const distMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const item of dist) {
        distMap[item.reviewScore] = item._count.id;
      }

      return JSON.stringify({
        averageRating: Math.round((agg._avg.reviewScore || 0) * 100) / 100,
        totalReviews: agg._count.id || 0,
        distribution: distMap,
        appliedFilters: {
          category: category || 'ALL',
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
        },
      });
    },
    {
      name: 'get_rating_summary',
      description: 'Calcula la calificación promedio, total de reseñas y distribución de estrellas (1 a 5), opcionalmente filtrado por categoría de producto.',
      schema: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        category: z.string().optional().describe('Nombre de la categoría de producto a filtrar (ej: informatica_acessorios, moveis_decoracao)'),
      }),
    }
  );

  return [getRatingSummary];
}
