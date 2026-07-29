import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRevenueSummary(query: AnalyticsQueryDto) {
    const where: any = {};
    if (query.dateFrom || query.dateTo) {
      where.orderPurchaseTimestamp = {};
      if (query.dateFrom)
        where.orderPurchaseTimestamp.gte = new Date(query.dateFrom);
      if (query.dateTo)
        where.orderPurchaseTimestamp.lte = new Date(query.dateTo);
    }

    const items = await this.prisma.olistOrderItem.aggregate({
      _sum: { price: true, freightValue: true },
      _count: { id: true },
      where: {
        order: where,
      },
    });

    const totalOrders = await this.prisma.olistOrder.count({ where });

    const revenue = Number(items._sum.price || 0);
    const freightTotal = Number(items._sum.freightValue || 0);
    const totalItems = items._count.id || 0;
    const avgOrderValue =
      totalOrders > 0 ? (revenue + freightTotal) / totalOrders : 0;

    return {
      revenue,
      freightTotal,
      totalOrders,
      totalItems,
      averageOrderValue: Math.round(avgOrderValue * 100) / 100,
    };
  }

  async getDeliveriesSummary(query: AnalyticsQueryDto) {
    const where: any = { orderStatus: 'delivered' };
    if (query.dateFrom || query.dateTo) {
      where.orderPurchaseTimestamp = {};
      if (query.dateFrom)
        where.orderPurchaseTimestamp.gte = new Date(query.dateFrom);
      if (query.dateTo)
        where.orderPurchaseTimestamp.lte = new Date(query.dateTo);
    }

    const deliveredOrders = await this.prisma.olistOrder.findMany({
      where,
      select: {
        orderPurchaseTimestamp: true,
        orderDeliveredCustomerDate: true,
        orderEstimatedDeliveryDate: true,
      },
    });

    let lateOrdersCount = 0;
    let totalDeliveryDays = 0;
    let totalDelayDays = 0;

    for (const order of deliveredOrders) {
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

    const totalDelivered = deliveredOrders.length;
    const lateRate =
      totalDelivered > 0 ? (lateOrdersCount / totalDelivered) * 100 : 0;
    const avgDeliveryDays =
      totalDelivered > 0 ? totalDeliveryDays / totalDelivered : 0;
    const avgDelayDays =
      lateOrdersCount > 0 ? totalDelayDays / lateOrdersCount : 0;

    return {
      deliveredOrders: totalDelivered,
      lateOrders: lateOrdersCount,
      lateRate: Math.round(lateRate * 10) / 10,
      averageDeliveryDays: Math.round(avgDeliveryDays * 10) / 10,
      averageDelayDays: Math.round(avgDelayDays * 10) / 10,
    };
  }

  async getReviewsSummary(query: AnalyticsQueryDto) {
    const where: any = {};
    if (query.dateFrom || query.dateTo) {
      where.order = {
        orderPurchaseTimestamp: {},
      };
      if (query.dateFrom)
        where.order.orderPurchaseTimestamp.gte = new Date(query.dateFrom);
      if (query.dateTo)
        where.order.orderPurchaseTimestamp.lte = new Date(query.dateTo);
    }

    const agg = await this.prisma.olistOrderReview.aggregate({
      _avg: { reviewScore: true },
      _count: { id: true },
      where,
    });

    const distribution = await this.prisma.olistOrderReview.groupBy({
      by: ['reviewScore'],
      _count: { id: true },
      where,
    });

    const distMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const item of distribution) {
      distMap[item.reviewScore] = item._count.id;
    }

    return {
      averageRating: Math.round((agg._avg.reviewScore || 0) * 100) / 100,
      totalReviews: agg._count.id || 0,
      distribution: distMap,
    };
  }

  async getSellersSummary(query: AnalyticsQueryDto) {
    const limit = query.limit || 10;

    const sellersAgg = await this.prisma.olistOrderItem.groupBy({
      by: ['sellerId'],
      _sum: { price: true },
      _count: { orderId: true },
      orderBy: {
        _sum: { price: 'desc' },
      },
      take: limit,
    });

    return sellersAgg.map((s) => ({
      sellerId: s.sellerId,
      revenue: s._sum.price || 0,
      itemsSold: s._count.orderId,
    }));
  }
}
