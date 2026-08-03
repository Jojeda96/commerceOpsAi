import { z } from 'zod';
import { ToolResultEnvelopeSchema } from '../common/tool-result.schema';

export const DeliveryAggregateDataSchema = z.object({
  deliveredOrders: z.number().nonnegative(),
  lateOrders: z.number().nonnegative(),
  aggregateLateRatePct: z.number().nonnegative(),
  averageDeliveryDays: z.number().nonnegative(),
  averageDelayDays: z.number().nonnegative(),
});

export const RouteMetricSchema = z.object({
  originState: z.string(),
  destinationState: z.string(),
  routeKey: z.string(),
  deliveredOrders: z.number().nonnegative(),
  lateOrders: z.number().nonnegative(),
  lateRatePct: z.number().nonnegative(),
  avgDeliveryDays: z.number().nonnegative(),
});

export const RouteDistributionDataSchema = z.object({
  eligibleRouteCount: z.number().nonnegative(),
  displayedRouteCount: z.number().nonnegative(),
  minOrdersPerRoute: z.number().nonnegative(),
  weightedRouteLateRatePct: z.number().nonnegative(),
  unweightedMeanRouteLateRatePct: z.number().nonnegative(),
  medianRouteLateRatePct: z.number().nonnegative(),
  routes: z.array(RouteMetricSchema),
});

export const StageBreakdownDataSchema = z.object({
  analyzedOrders: z.number().nonnegative(),
  excludedMissingCarrierDate: z.number().nonnegative(),
  avgSellerPreparationDays: z.number().nonnegative(),
  avgCarrierTransitDays: z.number().nonnegative(),
  medianSellerPreparationDays: z.number().nonnegative(),
  medianCarrierTransitDays: z.number().nonnegative(),
  dominantStage: z.enum(['SELLER_PREPARATION', 'CARRIER_TRANSIT', 'BALANCED']),
});

export const DeliveryAggregateResultSchema = ToolResultEnvelopeSchema.extend({
  data: DeliveryAggregateDataSchema.nullable(),
});

export const RouteDistributionResultSchema = ToolResultEnvelopeSchema.extend({
  data: RouteDistributionDataSchema.nullable(),
});

export const StageBreakdownResultSchema = ToolResultEnvelopeSchema.extend({
  data: StageBreakdownDataSchema.nullable(),
});
