import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaService } from '../../database/prisma.service';

export function createSellerPerformanceTools(prisma: PrismaService) {
  const getSellerScorecard = tool(
    async ({ sellerId }) => {
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

      return JSON.stringify({
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
        riskScore: lateRate > 20 || averageRating < 3.0 ? 'HIGH' : 'LOW',
      });
    },
    {
      name: 'get_seller_scorecard',
      description:
        'Genera una ficha completa de desempeño y riesgo operacional de un vendedor agrupado por pedido único.',
      schema: z.object({
        sellerId: z.string().describe('ID único del vendedor'),
      }),
    },
  );

  const getTopSellersByRevenue = tool(
    async ({ topN = 10 }) => {
      const items = await prisma.olistOrderItem.findMany({
        take: 5000,
        select: {
          sellerId: true,
          price: true,
          freightValue: true,
          seller: { select: { sellerState: true } },
        },
      });

      const sellerAgg: Record<string, { gmv: number; items: number; state: string }> = {};
      for (const item of items) {
        const sid = item.sellerId;
        const gmv = Number(item.price) + Number(item.freightValue || 0);
        if (!sellerAgg[sid]) {
          sellerAgg[sid] = { gmv: 0, items: 0, state: item.seller?.sellerState || 'UNK' };
        }
        sellerAgg[sid].gmv += gmv;
        sellerAgg[sid].items += 1;
      }

      const sorted = Object.entries(sellerAgg)
        .map(([sellerId, data]) => ({
          sellerId,
          sellerState: data.state,
          totalGmv: Math.round(data.gmv * 100) / 100,
          totalItemsSold: data.items,
        }))
        .sort((a, b) => b.totalGmv - a.totalGmv)
        .slice(0, topN);

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

  return [getSellerScorecard, getTopSellersByRevenue];
}
