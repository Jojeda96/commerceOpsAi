import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';
import { AnalysisScope, EvidenceMetric } from '@commerce-ops/shared-types';

function sellerScope(scopeHash = 'global-scope'): AnalysisScope {
  return {
    interstateOnly: false,
    provenance: [],
    scopeHash,
  };
}

export function createSellerPerformanceTools(prisma: PrismaService) {
  const getTopSellerByRevenue = tool(
    async ({ scopeHash = 'global-scope' }) => {
      const topSellers = await prisma.$queryRaw<
        {
          sellerId: string;
          totalRevenue: number;
          totalGmv: number;
          itemsSold: number;
          uniqueOrders: number;
        }[]
      >`
        SELECT
          seller_id AS "sellerId",
          SUM(price)::float AS "totalRevenue",
          SUM(price + freight_value)::float AS "totalGmv",
          COUNT(*)::int AS "itemsSold",
          COUNT(DISTINCT order_id)::int AS "uniqueOrders"
        FROM olist_order_items
        GROUP BY seller_id
        ORDER BY "totalRevenue" DESC
        LIMIT 1;
      `;

      if (!topSellers || topSellers.length === 0) {
        return JSON.stringify({
          status: 'NO_DATA',
          reasonCode: 'NO_SELLERS_WITH_REVENUE',
          scopeHash,
          appliedScope: sellerScope(scopeHash),
          rowCount: 0,
          sampleSize: 0,
          methods: ['SELLER_REVENUE_RANKING'],
          metrics: [],
          data: null,
        });
      }

      const top = topSellers[0];

      const data = {
        sellerId: top.sellerId,
        totalRevenue: Math.round(Number(top.totalRevenue) * 100) / 100,
        totalGmv: Math.round(Number(top.totalGmv) * 100) / 100,
        itemsSold: Number(top.itemsSold),
        uniqueOrders: Number(top.uniqueOrders),
      };

      const metrics: EvidenceMetric[] = [
        {
          key: 'seller.top.total_revenue',
          label: 'Ingresos acumulados del vendedor líder',
          value: data.totalRevenue,
          unit: 'BRL',
          sampleSize: data.uniqueOrders,
          sourcePath: '$.data.totalRevenue',
          aggregation: 'SUM',
        },
        {
          key: 'seller.top.total_gmv',
          label: 'GMV del vendedor líder',
          value: data.totalGmv,
          unit: 'BRL',
          sampleSize: data.uniqueOrders,
          sourcePath: '$.data.totalGmv',
          aggregation: 'SUM',
        },
        {
          key: 'seller.top.items_sold',
          label: 'Items vendidos por vendedor líder',
          value: data.itemsSold,
          unit: 'COUNT',
          sampleSize: data.itemsSold,
          sourcePath: '$.data.itemsSold',
          aggregation: 'COUNT',
        },
        {
          key: 'seller.top.unique_orders',
          label: 'Pedidos únicos del vendedor líder',
          value: data.uniqueOrders,
          unit: 'COUNT',
          sampleSize: data.uniqueOrders,
          sourcePath: '$.data.uniqueOrders',
          aggregation: 'COUNT',
        },
      ];

      return JSON.stringify({
        status: 'AVAILABLE',
        scopeHash,
        appliedScope: sellerScope(scopeHash),
        rowCount: 1,
        sampleSize: data.uniqueOrders,
        methods: ['SELLER_REVENUE_RANKING'],
        metrics,
        data,
      });
    },
    {
      name: 'get_top_seller_by_revenue',
      description:
        'Obtiene el vendedor único con mayores ingresos acumulados (SUM(price)) en toda la plataforma.',
      schema: z.object({
        scopeHash: z.string().default('global-scope'),
      }),
    },
  );

  const getSellerScorecard = tool(
    async ({ sellerId, scopeHash = 'global-scope' }) => {
      const items = await prisma.olistOrderItem.findMany({
        where: { sellerId },
        include: {
          order: {
            include: {
              reviews: true,
            },
          },
        },
      });

      if (items.length === 0) {
        return JSON.stringify({
          status: 'NO_DATA',
          reasonCode: 'SELLER_HAS_NO_ORDER_ITEMS',
          scopeHash,
          appliedScope: sellerScope(scopeHash),
          rowCount: 0,
          sampleSize: 0,
          methods: ['SELLER_SCORECARD_AGGREGATION'],
          metrics: [],
          data: null,
        });
      }

      const orderMap = new Map<string, (typeof items)[0]['order']>();
      let revenue = 0;
      let freightTotal = 0;

      for (const item of items) {
        revenue += Number(item.price);
        freightTotal += Number(item.freightValue || 0);
        if (!orderMap.has(item.orderId)) {
          orderMap.set(item.orderId, item.order);
        }
      }

      const uniqueOrders = Array.from(orderMap.values());
      const deliveredOrders = uniqueOrders.filter(
        (o) => o.orderDeliveredCustomerDate && o.orderEstimatedDeliveryDate,
      );

      let lateCount = 0;
      for (const order of deliveredOrders) {
        if (
          order.orderDeliveredCustomerDate! > order.orderEstimatedDeliveryDate
        ) {
          lateCount++;
        }
      }

      const reviewMap = new Map<string, number>();
      for (const order of uniqueOrders) {
        for (const r of order.reviews) {
          if (!reviewMap.has(r.reviewId)) {
            reviewMap.set(r.reviewId, r.reviewScore);
          }
        }
      }

      const uniqueRatings = Array.from(reviewMap.values());
      const totalRating = uniqueRatings.reduce((sum, r) => sum + r, 0);
      const averageRating =
        uniqueRatings.length > 0 ? totalRating / uniqueRatings.length : 0;
      const lateRate =
        deliveredOrders.length > 0
          ? (lateCount / deliveredOrders.length) * 100
          : 0;

      let riskScore: 'LOW' | 'MEDIUM' | 'HIGH';
      if (lateRate >= 20 || averageRating < 3.0) {
        riskScore = 'HIGH';
      } else if (lateRate >= 10 || averageRating < 3.8) {
        riskScore = 'MEDIUM';
      } else {
        riskScore = 'LOW';
      }

      const data = {
        sellerId,
        totalItemsSold: items.length,
        totalUniqueOrders: uniqueOrders.length,
        totalRevenue: Math.round(revenue * 100) / 100,
        totalGmv: Math.round((revenue + freightTotal) * 100) / 100,
        deliveredOrders: deliveredOrders.length,
        lateOrders: lateCount,
        lateRate: Math.round(lateRate * 10) / 10,
        averageRating: Math.round(averageRating * 100) / 100,
        totalReviews: uniqueRatings.length,
        riskScore,
        riskPolicyVersion: 'seller-risk-v1',
      };

      const metrics: EvidenceMetric[] = [
        {
          key: 'seller.revenue',
          label: 'Ingresos acumulados del vendedor',
          value: data.totalRevenue,
          unit: 'BRL',
          sampleSize: data.totalUniqueOrders,
          sourcePath: '$.data.totalRevenue',
          aggregation: 'SUM',
        },
        {
          key: 'seller.gmv',
          label: 'GMV acumulado del vendedor',
          value: data.totalGmv,
          unit: 'BRL',
          sampleSize: data.totalUniqueOrders,
          sourcePath: '$.data.totalGmv',
          aggregation: 'SUM',
        },
        {
          key: 'seller.unique_orders',
          label: 'Pedidos únicos del vendedor',
          value: data.totalUniqueOrders,
          unit: 'COUNT',
          sampleSize: data.totalUniqueOrders,
          sourcePath: '$.data.totalUniqueOrders',
          aggregation: 'COUNT',
        },
        {
          key: 'seller.items_sold',
          label: 'Items vendidos por el vendedor',
          value: data.totalItemsSold,
          unit: 'COUNT',
          sampleSize: data.totalItemsSold,
          sourcePath: '$.data.totalItemsSold',
          aggregation: 'COUNT',
        },
        {
          key: 'seller.delivered_orders',
          label: 'Pedidos entregados del vendedor',
          value: data.deliveredOrders,
          unit: 'COUNT',
          sampleSize: data.deliveredOrders,
          sourcePath: '$.data.deliveredOrders',
          aggregation: 'COUNT',
        },
        {
          key: 'seller.late_orders',
          label: 'Pedidos tardíos del vendedor',
          value: data.lateOrders,
          unit: 'COUNT',
          sampleSize: data.deliveredOrders,
          sourcePath: '$.data.lateOrders',
          aggregation: 'COUNT',
        },
        {
          key: 'seller.late_rate_pct',
          label: 'Tasa de atraso del vendedor',
          value: data.lateRate,
          unit: 'PERCENT',
          sampleSize: data.deliveredOrders,
          sourcePath: '$.data.lateRate',
          aggregation: 'WEIGHTED_RATE',
        },
        {
          key: 'seller.average_rating',
          label: 'Rating promedio del vendedor',
          value: data.averageRating,
          unit: 'SCORE',
          sampleSize: data.totalReviews,
          sourcePath: '$.data.averageRating',
          aggregation: 'MEAN',
        },
        {
          key: 'seller.total_reviews',
          label: 'Total de reviews del vendedor',
          value: data.totalReviews,
          unit: 'COUNT',
          sampleSize: data.totalReviews,
          sourcePath: '$.data.totalReviews',
          aggregation: 'COUNT',
        },
      ];

      return JSON.stringify({
        status: 'AVAILABLE',
        scopeHash,
        appliedScope: sellerScope(scopeHash),
        rowCount: data.totalUniqueOrders,
        sampleSize: data.totalUniqueOrders,
        methods: ['SELLER_SCORECARD_AGGREGATION'],
        metrics,
        data,
      });
    },
    {
      name: 'get_seller_scorecard',
      description:
        'Genera una ficha completa de desempeño y riesgo operacional de un vendedor agrupado por pedido único.',
      schema: z.object({
        sellerId: z.string().describe('ID único del vendedor'),
        scopeHash: z.string().default('global-scope'),
      }),
    },
  );

  const getTopSellersByRevenue = tool(
    async ({ topN = 10 }) => {
      const topSellers = await prisma.$queryRaw<
        {
          sellerId: string;
          totalGmv: number;
          itemsSold: number;
        }[]
      >`
        SELECT
          seller_id AS "sellerId",
          SUM(price + freight_value)::float AS "totalGmv",
          COUNT(*)::int AS "itemsSold"
        FROM olist_order_items
        GROUP BY seller_id
        ORDER BY "totalGmv" DESC
        LIMIT ${topN};
      `;

      const sorted = topSellers.map((s) => ({
        sellerId: s.sellerId,
        totalGmv: Math.round(s.totalGmv * 100) / 100,
        totalItemsSold: Number(s.itemsSold),
      }));

      return JSON.stringify(sorted);
    },
    {
      name: 'get_top_sellers_by_revenue',
      description:
        'Calcula el ranking de principales vendedores ordenados por ventas totales en GMV (SUM(price + freightValue)).',
      schema: z.object({
        topN: z.number().default(10),
      }),
    },
  );

  return [getTopSellerByRevenue, getSellerScorecard, getTopSellersByRevenue];
}
