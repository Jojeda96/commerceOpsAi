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
        if (dateFrom)
          where.order.orderPurchaseTimestamp.gte = new Date(dateFrom);
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
      description:
        'Calcula la calificación promedio, total de reseñas y distribución de estrellas (1 a 5), opcionalmente filtrado por categoría de producto.',
      schema: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        category: z
          .string()
          .optional()
          .describe(
            'Nombre de la categoría de producto a filtrar (ej: informatica_acessorios, moveis_decoracao)',
          ),
      }),
    },
  );

  const searchReviewsSemantic = tool(
    async ({ query, topK = 5, reviewScores, categories, dateFrom, dateTo }) => {
      const mlServiceUrl =
        process.env.ML_SERVICE_URL || 'http://localhost:8000';
      try {
        const response = await fetch(`${mlServiceUrl}/nlp/reviews/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            top_k: topK,
            review_scores: reviewScores,
            categories,
            date_from: dateFrom,
            date_to: dateTo,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return JSON.stringify(data);
        }
      } catch (err) {
        console.warn(
          '[CX Tools] ML Service NLP endpoint no disponible, usando fallback SQL:',
          err,
        );
      }

      // Fallback SQL
      const reviews = await prisma.olistOrderReview.findMany({
        where: {
          reviewCommentMessage: { contains: query, mode: 'insensitive' },
          ...(reviewScores && reviewScores.length > 0 ? { reviewScore: { in: reviewScores } } : {}),
        },
        take: topK,
        select: {
          reviewId: true,
          reviewScore: true,
          reviewCommentMessage: true,
        },
      });

      return JSON.stringify({
        query,
        method: 'sql_text_search_fallback',
        results: reviews,
      });
    },
    {
      name: 'search_reviews_semantic',
      description:
        'Busca reseñas de clientes semánticamente relevantes utilizando el servicio de NLP con filtros por calificación, categorías y fechas.',
      schema: z.object({
        query: z
          .string()
          .describe(
            'Término de búsqueda o consulta semántica sobre las reseñas',
          ),
        topK: z
          .number()
          .default(5)
          .describe('Cantidad máxima de reseñas a devolver'),
        reviewScores: z.array(z.number()).optional(),
        categories: z.array(z.string()).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }),
    },
  );

  return [getRatingSummary, searchReviewsSemantic];
}
