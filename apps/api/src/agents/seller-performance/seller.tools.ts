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

      const totalItems = items.length;
      let revenue = 0;
      let lateCount = 0;
      let totalRating = 0;
      let ratingCount = 0;

      for (const item of items) {
        revenue += item.price;
        if (
          item.order.orderDeliveredCustomerDate &&
          item.order.orderEstimatedDeliveryDate &&
          item.order.orderDeliveredCustomerDate > item.order.orderEstimatedDeliveryDate
        ) {
          lateCount++;
        }

        for (const r of item.order.reviews) {
          totalRating += r.reviewScore;
          ratingCount++;
        }
      }

      const lateRate = totalItems > 0 ? (lateCount / totalItems) * 100 : 0;
      const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;

      return JSON.stringify({
        sellerId,
        totalItemsSold: totalItems,
        totalRevenue: revenue,
        lateRate: Math.round(lateRate * 10) / 10,
        averageRating: Math.round(averageRating * 100) / 100,
        riskScore: lateRate > 20 || averageRating < 3.0 ? 'HIGH' : 'LOW',
      });
    },
    {
      name: 'get_seller_scorecard',
      description: 'Genera una ficha completa de desempeño y riesgo operacional de un vendedor.',
      schema: z.object({
        sellerId: z.string().describe('ID único del vendedor'),
      }),
    }
  );

  return [getSellerScorecard];
}
