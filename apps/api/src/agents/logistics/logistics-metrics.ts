import { ScopedDeliveredOrder } from './delivery-scope.types';
import {
  DeliveryAggregateData,
  RouteDistributionData,
  RouteMetric,
  StageBreakdownData,
} from '@commerce-ops/shared-types';
import { formatRouteKey } from './canonical-route';

export function round1(num: number): number {
  return Math.round(num * 10) / 10;
}

export function computeDeliveryAggregate(
  orders: ScopedDeliveredOrder[],
): DeliveryAggregateData | null {
  const deliveredOrders = orders.length;
  if (deliveredOrders === 0) return null;

  let lateOrders = 0;
  let totalDeliveryDays = 0;
  let totalDelayDays = 0;

  for (const order of orders) {
    if (order.isLate) {
      lateOrders++;
      const delayDays =
        (order.deliveredCustomerDate.getTime() -
          order.estimatedDeliveryDate.getTime()) /
        (1000 * 3600 * 24);
      totalDelayDays += Math.max(0, delayDays);
    }

    const deliveryDays =
      (order.deliveredCustomerDate.getTime() -
        order.purchaseTimestamp.getTime()) /
      (1000 * 3600 * 24);
    totalDeliveryDays += Math.max(0, deliveryDays);
  }

  const aggregateLateRatePct = round1((lateOrders / deliveredOrders) * 100);
  const averageDeliveryDays = round1(totalDeliveryDays / deliveredOrders);
  const averageDelayDays =
    lateOrders > 0 ? round1(totalDelayDays / lateOrders) : 0;

  return {
    deliveredOrders,
    lateOrders,
    aggregateLateRatePct,
    averageDeliveryDays,
    averageDelayDays,
  };
}

export function computeRouteDistribution(
  orders: ScopedDeliveredOrder[],
  minOrdersPerRoute = 10,
  topN = 10,
): RouteDistributionData | null {
  if (orders.length === 0) return null;

  const routeMap = new Map<
    string,
    {
      originState: string;
      destinationState: string;
      delivered: number;
      late: number;
      totalDays: number;
    }
  >();

  for (const order of orders) {
    const key = formatRouteKey(order.primarySellerState, order.customerState);
    const current = routeMap.get(key) || {
      originState: order.primarySellerState,
      destinationState: order.customerState,
      delivered: 0,
      late: 0,
      totalDays: 0,
    };

    current.delivered++;
    if (order.isLate) current.late++;
    const delDays =
      (order.deliveredCustomerDate.getTime() -
        order.purchaseTimestamp.getTime()) /
      (1000 * 3600 * 24);
    current.totalDays += Math.max(0, delDays);

    routeMap.set(key, current);
  }

  const allRoutes: RouteMetric[] = [];
  let totalEligibleDelivered = 0;
  let totalEligibleLate = 0;

  for (const [routeKey, r] of routeMap.entries()) {
    if (r.delivered >= minOrdersPerRoute) {
      allRoutes.push({
        originState: r.originState,
        destinationState: r.destinationState,
        routeKey,
        deliveredOrders: r.delivered,
        lateOrders: r.late,
        lateRatePct: round1((r.late / r.delivered) * 100),
        avgDeliveryDays: round1(r.totalDays / r.delivered),
      });

      totalEligibleDelivered += r.delivered;
      totalEligibleLate += r.late;
    }
  }

  const eligibleRouteCount = allRoutes.length;
  if (eligibleRouteCount === 0) {
    return {
      eligibleRouteCount: 0,
      displayedRouteCount: 0,
      minOrdersPerRoute,
      weightedRouteLateRatePct: 0,
      unweightedMeanRouteLateRatePct: 0,
      medianRouteLateRatePct: 0,
      routes: [],
    };
  }

  const weightedRouteLateRatePct = round1(
    (totalEligibleLate / totalEligibleDelivered) * 100,
  );

  const rates = allRoutes.map((r) => r.lateRatePct).sort((a, b) => a - b);
  const sumRates = rates.reduce((acc, v) => acc + v, 0);
  const unweightedMeanRouteLateRatePct = round1(sumRates / eligibleRouteCount);

  let medianRouteLateRatePct = 0;
  const mid = Math.floor(rates.length / 2);
  if (rates.length % 2 === 0) {
    medianRouteLateRatePct = round1((rates[mid - 1] + rates[mid]) / 2);
  } else {
    medianRouteLateRatePct = round1(rates[mid]);
  }

  const sortedByVolumeAndRate = [...allRoutes].sort(
    (a, b) => b.deliveredOrders - a.deliveredOrders,
  );
  const displayedRoutes = sortedByVolumeAndRate.slice(0, topN);

  return {
    eligibleRouteCount,
    displayedRouteCount: displayedRoutes.length,
    minOrdersPerRoute,
    weightedRouteLateRatePct,
    unweightedMeanRouteLateRatePct,
    medianRouteLateRatePct,
    routes: displayedRoutes,
  };
}

export function computeStageBreakdown(
  orders: ScopedDeliveredOrder[],
): StageBreakdownData | null {
  if (orders.length === 0) return null;

  let analyzedOrders = 0;
  let excludedMissingCarrierDate = 0;
  let totalPrepDays = 0;
  let totalTransitDays = 0;

  const prepDaysList: number[] = [];
  const transitDaysList: number[] = [];

  for (const order of orders) {
    if (!order.deliveredCarrierDate) {
      excludedMissingCarrierDate++;
      continue;
    }

    const prepDays = Math.max(
      0,
      (order.deliveredCarrierDate.getTime() -
        order.purchaseTimestamp.getTime()) /
        (1000 * 3600 * 24),
    );
    const transitDays = Math.max(
      0,
      (order.deliveredCustomerDate.getTime() -
        order.deliveredCarrierDate.getTime()) /
        (1000 * 3600 * 24),
    );

    analyzedOrders++;
    totalPrepDays += prepDays;
    totalTransitDays += transitDays;

    prepDaysList.push(prepDays);
    transitDaysList.push(transitDays);
  }

  if (analyzedOrders === 0) return null;

  const avgSellerPreparationDays = round1(totalPrepDays / analyzedOrders);
  const avgCarrierTransitDays = round1(totalTransitDays / analyzedOrders);

  const getMedian = (list: number[]) => {
    const sorted = [...list].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? round1((sorted[mid - 1] + sorted[mid]) / 2)
      : round1(sorted[mid]);
  };

  const medianSellerPreparationDays = getMedian(prepDaysList);
  const medianCarrierTransitDays = getMedian(transitDaysList);

  let dominantStage: 'SELLER_PREPARATION' | 'CARRIER_TRANSIT' | 'BALANCED' =
    'BALANCED';
  if (avgSellerPreparationDays > avgCarrierTransitDays * 1.2) {
    dominantStage = 'SELLER_PREPARATION';
  } else if (avgCarrierTransitDays > avgSellerPreparationDays * 1.2) {
    dominantStage = 'CARRIER_TRANSIT';
  }

  return {
    analyzedOrders,
    excludedMissingCarrierDate,
    avgSellerPreparationDays,
    avgCarrierTransitDays,
    medianSellerPreparationDays,
    medianCarrierTransitDays,
    dominantStage,
  };
}
