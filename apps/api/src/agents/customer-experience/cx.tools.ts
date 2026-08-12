import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';
import { ReviewComplaintRepository } from './review-complaint.repository';

export function createCustomerExperienceTools(prisma: PrismaService) {
  const repository = new ReviewComplaintRepository(prisma);

  const analyzeReviewComplaints = tool(
    async (input) => {
      const envelope = await repository.analyzeReviewComplaints(input);
      return JSON.stringify(envelope);
    },
    {
      name: 'analyze_review_complaints',
      description:
        'Analiza determinísticamente quejas en reseñas de clientes agrupadas por temas (DELIVERY_DELAY, PACKAGE_DAMAGE) y calcula frecuencias, porcentajes y ejemplos reales.',
      schema: z.object({
        topics: z
          .array(z.enum(['DELIVERY_DELAY', 'PACKAGE_DAMAGE']))
          .min(1)
          .describe('Temas a analizar'),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        categories: z.array(z.string()).optional(),
        minimumReviewScore: z.number().min(1).max(5).optional(),
        maximumReviewScore: z.number().min(1).max(5).optional(),
        examplesPerSubtheme: z.number().min(1).max(5).default(3),
        scopeHash: z.string().describe('Scope hash asignado inmutable'),
      }),
    },
  );

  const getRatingSummary = tool(
    async ({ dateFrom, dateTo, category, scopeHash }) => {
      const where: any = {};

      if (dateFrom || dateTo) {
        where.order = { orderPurchaseTimestamp: {} };
        if (dateFrom)
          where.order.orderPurchaseTimestamp.gte = new Date(dateFrom);
        if (dateTo) where.order.orderPurchaseTimestamp.lte = new Date(dateTo);
      }

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

      const totalReviews = agg._count.id || 0;
      const averageRating = Math.round((agg._avg.reviewScore || 0) * 100) / 100;

      return JSON.stringify({
        status: totalReviews > 0 ? 'AVAILABLE' : 'NO_DATA',
        reasonCode: totalReviews > 0 ? undefined : 'NO_RATINGS_IN_SCOPE',
        scopeHash: scopeHash || 'global-scope',
        appliedScope: {
          category: category || null,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
          scopeHash: scopeHash || 'global-scope',
        },
        rowCount: totalReviews,
        sampleSize: totalReviews,
        methods: ['RATING_DISTRIBUTION'],
        metrics: [
          {
            key: 'reviews.rating.total',
            label: 'Total de reseñas',
            value: totalReviews,
            unit: 'COUNT',
            sampleSize: totalReviews,
            sourcePath: '$.data.totalReviews',
            aggregation: 'COUNT',
          },
          {
            key: 'reviews.rating.average',
            label: 'Calificación promedio',
            value: averageRating,
            unit: 'RATING',
            sampleSize: totalReviews,
            sourcePath: '$.data.averageRating',
            aggregation: 'MEAN',
          },
          ...Object.entries(distMap).map(([score, count]) => ({
            key: `reviews.rating.score_${score}.count`,
            label: `Reseñas de ${score} estrellas`,
            value: count,
            unit: 'COUNT',
            sampleSize: totalReviews,
            sourcePath: `$.data.distribution.${score}`,
            aggregation: 'COUNT',
          })),
        ],
        data: {
          averageRating,
          totalReviews,
          distribution: distMap,
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
        scopeHash: z
          .string()
          .optional()
          .describe('Scope hash asignado inmutable'),
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
          ...(reviewScores && reviewScores.length > 0
            ? { reviewScore: { in: reviewScores } }
            : {}),
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

  const compareRatingSummaryPeriods = tool(
    async ({
      dateFrom,
      dateTo,
      comparisonDateFrom,
      comparisonDateTo,
      category,
      scopeHash,
    }) => {
      async function fetchRatingData(
        dFrom?: string,
        dTo?: string,
        cat?: string,
      ) {
        const where: any = {};
        if (dFrom || dTo) {
          where.order = { orderPurchaseTimestamp: {} };
          if (dFrom) where.order.orderPurchaseTimestamp.gte = new Date(dFrom);
          if (dTo) where.order.orderPurchaseTimestamp.lte = new Date(dTo);
        }
        if (cat) {
          if (!where.order) where.order = {};
          where.order.items = {
            some: {
              product: {
                productCategoryName: {
                  contains: cat,
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

        const distMap: Record<number, number> = {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0,
        };
        for (const item of dist) {
          distMap[item.reviewScore] = item._count.id;
        }

        const totalReviews = agg._count.id || 0;
        const averageRating =
          Math.round((agg._avg.reviewScore || 0) * 100) / 100;

        return { averageRating, totalReviews, distribution: distMap };
      }

      const target = await fetchRatingData(dateFrom, dateTo, category);
      const reference = await fetchRatingData(
        comparisonDateFrom,
        comparisonDateTo,
        category,
      );

      if (target.totalReviews === 0 || reference.totalReviews === 0) {
        return JSON.stringify({
          status: 'NO_DATA',
          reasonCode: 'RATING_COMPARISON_PERIOD_HAS_NO_REVIEWS',
          scopeHash: scopeHash || 'global-scope',
          appliedScope: {
            category: category || null,
            dateFrom: dateFrom || null,
            dateTo: dateTo || null,
            comparisonDateFrom,
            comparisonDateTo,
            scopeHash: scopeHash || 'global-scope',
          },
          rowCount: target.totalReviews + reference.totalReviews,
          sampleSize: target.totalReviews + reference.totalReviews,
          methods: ['TEMPORAL_COMPARISON'],
          metrics: [],
          data: {
            target,
            reference,
          },
        });
      }

      const deltaRating =
        Math.round((target.averageRating - reference.averageRating) * 100) /
        100;

      const relativeChangePct =
        reference.averageRating > 0
          ? Math.round(
              ((target.averageRating - reference.averageRating) /
                reference.averageRating) *
                1000,
            ) / 10
          : 0;

      return JSON.stringify({
        status: 'AVAILABLE',
        scopeHash: scopeHash || 'global-scope',
        appliedScope: {
          category: category || null,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
          comparisonDateFrom,
          comparisonDateTo,
          scopeHash: scopeHash || 'global-scope',
        },
        rowCount: target.totalReviews + reference.totalReviews,
        sampleSize: target.totalReviews + reference.totalReviews,
        methods: ['TEMPORAL_COMPARISON'],
        metrics: [
          {
            key: 'reviews.comparison.target_rating',
            label: 'Rating promedio periodo objetivo',
            value: target.averageRating,
            unit: 'SCORE',
            sampleSize: target.totalReviews,
            sourcePath: '$.data.target.averageRating',
            aggregation: 'MEAN',
          },
          {
            key: 'reviews.comparison.reference_rating',
            label: 'Rating promedio periodo referencia',
            value: reference.averageRating,
            unit: 'SCORE',
            sampleSize: reference.totalReviews,
            sourcePath: '$.data.reference.averageRating',
            aggregation: 'MEAN',
          },
          {
            key: 'reviews.comparison.delta_rating',
            label: 'Diferencia en puntos de calificación',
            value: deltaRating,
            unit: 'SCORE',
            sampleSize: target.totalReviews + reference.totalReviews,
            sourcePath: '$.data.deltaRating',
            aggregation: 'MEAN',
          },
          {
            key: 'reviews.comparison.relative_change_pct',
            label: 'Variación relativa de calificación promedio',
            value: relativeChangePct,
            unit: 'PERCENT',
            sampleSize: target.totalReviews + reference.totalReviews,
            sourcePath: '$.data.relativeChangePct',
            aggregation: 'MEAN',
          },
        ],
        data: {
          target,
          reference,
          deltaRating,
          relativeChangePct,
        },
      });
    },
    {
      name: 'compare_rating_summary_periods',
      description:
        'Compara la calificación promedio de reseñas entre un periodo objetivo y un periodo de referencia.',
      schema: z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        comparisonDateFrom: z.string(),
        comparisonDateTo: z.string(),
        category: z.string().optional(),
        scopeHash: z.string().optional(),
      }),
    },
  );

  return [
    analyzeReviewComplaints,
    getRatingSummary,
    searchReviewsSemantic,
    compareRatingSummaryPeriods,
  ];
}
