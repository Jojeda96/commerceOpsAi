import { PrismaClient, Prisma } from '@prisma/client';

export interface FeatureSnapshotFilters {
  customerStates?: string[];
  sellerStates?: string[];
  categories?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  interstateOnly?: boolean;
  minOrders?: number;
  limit?: number;
  selectionMethod?:
    | 'REPRESENTATIVE_MEDIAN' | 'HIGH_RISK_HISTORICAL' | (string & {});
}

export interface ScenarioSnapshotRow {
  scenarioId: string;
  primarySellerState: string;
  customerState: string;
  primaryCategory: string;
  totalPrice: number;
  totalFreight: number;
  totalWeightG: number;
  totalVolumeCm3: number;
  itemCount: number;
  sellerCount: number;
  estimatedDeliveryDays: number;
  shippingWindowDays: number;
  routeDistanceKm: number | null;
  purchaseDow: number;
  purchaseHour: number;
  purchaseMonth: number;
  purchaseWeek: number;
  sellerPriorOrders: number;
  sellerPriorLateRateSmoothed: number;
  routePriorOrders: number;
  routePriorLateRateSmoothed: number;
  categoryPriorOrders: number;
  categoryPriorLateRateSmoothed: number;
  sampleSize: number;
  historicalLateRate: number;
}

export class DeliveryFeatureSnapshotsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findSnapshots(
    options: FeatureSnapshotFilters = {},
  ): Promise<ScenarioSnapshotRow[]> {
    const limit = options.limit || 3;
    const minOrders = options.minOrders || 5;
    const selectionMethod = options.selectionMethod || 'REPRESENTATIVE_MEDIAN';

    const customerStatesFilter =
      options.customerStates && options.customerStates.length > 0
        ? Prisma.sql`AND customer_state IN (${Prisma.join(options.customerStates)})`
        : Prisma.empty;

    const sellerStatesFilter =
      options.sellerStates && options.sellerStates.length > 0
        ? Prisma.sql`AND primary_seller_state IN (${Prisma.join(options.sellerStates)})`
        : Prisma.empty;

    const categoriesFilter =
      options.categories && options.categories.length > 0
        ? Prisma.sql`AND primary_category IN (${Prisma.join(options.categories)})`
        : Prisma.empty;

    const dateFromFilter = options.dateFrom
      ? Prisma.sql`AND purchase_date >= ${options.dateFrom}`
      : Prisma.empty;

    const dateToFilter = options.dateTo
      ? Prisma.sql`AND purchase_date <= ${options.dateTo}`
      : Prisma.empty;

    const interstateFilter = options.interstateOnly
      ? Prisma.sql`AND primary_seller_state <> customer_state`
      : Prisma.empty;

    const orderByClause =
      selectionMethod === 'HIGH_RISK_HISTORICAL'
        ? Prisma.sql`ORDER BY AVG(CASE WHEN is_delayed THEN 1.0 ELSE 0.0 END) DESC, COUNT(*) DESC`
        : Prisma.sql`ORDER BY COUNT(*) DESC, AVG(CASE WHEN is_delayed THEN 1.0 ELSE 0.0 END) DESC`;

    const query = Prisma.sql`
      SELECT
        primary_seller_state AS "primarySellerState",
        customer_state AS "customerState",
        primary_category AS "primaryCategory",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_price)::float AS "totalPrice",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_freight)::float AS "totalFreight",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_weight_g)::float AS "totalWeightG",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_volume_cm3)::float AS "totalVolumeCm3",
        ROUND(AVG(item_count))::int AS "itemCount",
        ROUND(AVG(seller_count))::int AS "sellerCount",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY estimated_delivery_days)::float AS "estimatedDeliveryDays",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY shipping_window_days)::float AS "shippingWindowDays",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY route_distance_km)::float AS "routeDistanceKm",
        MODE() WITHIN GROUP (ORDER BY purchase_dow)::int AS "purchaseDow",
        MODE() WITHIN GROUP (ORDER BY purchase_hour)::int AS "purchaseHour",
        MODE() WITHIN GROUP (ORDER BY purchase_month)::int AS "purchaseMonth",
        MODE() WITHIN GROUP (ORDER BY purchase_week)::int AS "purchaseWeek",
        ROUND(AVG(seller_prior_orders))::int AS "sellerPriorOrders",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY seller_prior_late_rate_smoothed)::float AS "sellerPriorLateRateSmoothed",
        ROUND(AVG(route_prior_orders))::int AS "routePriorOrders",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY route_prior_late_rate_smoothed)::float AS "routePriorLateRateSmoothed",
        ROUND(AVG(category_prior_orders))::int AS "categoryPriorOrders",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY category_prior_late_rate_smoothed)::float AS "categoryPriorLateRateSmoothed",
        COUNT(*)::int AS "sampleSize",
        AVG(CASE WHEN is_delayed THEN 1.0 ELSE 0.0 END)::float AS "historicalLateRate"
      FROM delivery_feature_snapshots
      WHERE 1=1
        ${customerStatesFilter}
        ${sellerStatesFilter}
        ${categoriesFilter}
        ${dateFromFilter}
        ${dateToFilter}
        ${interstateFilter}
      GROUP BY primary_seller_state, customer_state, primary_category
      HAVING COUNT(*) >= ${minOrders}
      ${orderByClause}
      LIMIT ${limit};
    `;

    try {
      const rows = await this.prisma.$queryRaw<any[]>(query);
      return rows.map((r, idx) => ({
        scenarioId: `scen-snap-${r.primarySellerState}-${r.customerState}-${r.primaryCategory}-${idx + 1}`,
        primarySellerState: r.primarySellerState,
        customerState: r.customerState,
        primaryCategory: r.primaryCategory,
        totalPrice: Number(r.totalPrice),
        totalFreight: Number(r.totalFreight),
        totalWeightG: Number(r.totalWeightG),
        totalVolumeCm3: Number(r.totalVolumeCm3),
        itemCount: Number(r.itemCount),
        sellerCount: Number(r.sellerCount),
        estimatedDeliveryDays: Number(r.estimatedDeliveryDays),
        shippingWindowDays: Number(r.shippingWindowDays),
        routeDistanceKm:
          r.routeDistanceKm !== null ? Number(r.routeDistanceKm) : null,
        purchaseDow: Number(r.purchaseDow),
        purchaseHour: Number(r.purchaseHour),
        purchaseMonth: Number(r.purchaseMonth),
        purchaseWeek: Number(r.purchaseWeek),
        sellerPriorOrders: Number(r.sellerPriorOrders),
        sellerPriorLateRateSmoothed: Number(r.sellerPriorLateRateSmoothed),
        routePriorOrders: Number(r.routePriorOrders),
        routePriorLateRateSmoothed: Number(r.routePriorLateRateSmoothed),
        categoryPriorOrders: Number(r.categoryPriorOrders),
        categoryPriorLateRateSmoothed: Number(r.categoryPriorLateRateSmoothed),
        sampleSize: Number(r.sampleSize),
        historicalLateRate: Number(r.historicalLateRate),
      }));
    } catch (err) {
      console.warn(
        '[DeliveryFeatureSnapshotsRepository] Failed querying delivery_feature_snapshots table:',
        err,
      );
      return [];
    }
  }
}
