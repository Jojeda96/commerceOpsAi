import { PrismaClient, Prisma } from '@prisma/client';

export interface DeliveryScenarioRow {
  scenarioId: string;
  sellerState: string;
  customerState: string;
  primaryCategory: string | null;
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
  sellerPriorLateRate: number | null;
  routePriorOrders: number;
  routePriorLateRate: number | null;
  categoryPriorOrders: number;
  categoryPriorLateRate: number | null;
  sampleSize: number;
  historicalLateRate: number;
}

export interface GetScenariosOptions {
  limit?: number;
  selectionMethod?: string;
  customerStates?: string[];
  categories?: string[];
  minOrders?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

export class DeliveryScenariosRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getScenarios(
    options: GetScenariosOptions = {},
  ): Promise<DeliveryScenarioRow[]> {
    const limit = options.limit || 3;
    const minOrders = options.minOrders || 10;
    const selectionMethod = options.selectionMethod || 'TOP_VOLUME';

    const customerStatesFilter =
      options.customerStates && options.customerStates.length > 0
        ? Prisma.sql`AND c.customer_state IN (${Prisma.join(options.customerStates)})`
        : Prisma.empty;

    const categoriesFilter =
      options.categories && options.categories.length > 0
        ? Prisma.sql`AND p.product_category_name IN (${Prisma.join(options.categories)})`
        : Prisma.empty;

    const dateFromFilter = options.dateFrom
      ? Prisma.sql`AND o.order_purchase_timestamp >= ${options.dateFrom}`
      : Prisma.empty;

    const dateToFilter = options.dateTo
      ? Prisma.sql`AND o.order_purchase_timestamp <= ${options.dateTo}`
      : Prisma.empty;

    const orderByClause =
      selectionMethod === 'LATE_RATE'
        ? Prisma.sql`ORDER BY historical_late_rate DESC, sample_size DESC`
        : Prisma.sql`ORDER BY sample_size DESC, historical_late_rate DESC`;

    const rawQuery = Prisma.sql`
      WITH order_aggregates AS (
        SELECT
          o.id AS order_id,
          s.seller_state,
          c.customer_state,
          p.product_category_name,
          COALESCE(SUM(i.price), 0) AS total_price,
          COALESCE(SUM(i.freight_value), 0) AS total_freight,
          COALESCE(SUM(p.product_weight_g), 500) AS total_weight_g,
          COALESCE(SUM(p.product_length_cm * p.product_height_cm * p.product_width_cm), 4500) AS total_volume_cm3,
          COUNT(i.id) AS item_count,
          COUNT(DISTINCT i.seller_id) AS seller_count,
          EXTRACT(EPOCH FROM (o.order_estimated_delivery_date - o.order_purchase_timestamp)) / 86400.0 AS est_days,
          CASE
            WHEN o.order_delivered_carrier_date IS NOT NULL THEN
              EXTRACT(EPOCH FROM (o.order_delivered_carrier_date - o.order_purchase_timestamp)) / 86400.0
            ELSE
              EXTRACT(EPOCH FROM (o.order_estimated_delivery_date - o.order_purchase_timestamp)) / 86400.0
          END AS ship_days,
          EXTRACT(DOW FROM o.order_purchase_timestamp) AS purchase_dow,
          EXTRACT(HOUR FROM o.order_purchase_timestamp) AS purchase_hour,
          EXTRACT(MONTH FROM o.order_purchase_timestamp) AS purchase_month,
          EXTRACT(WEEK FROM o.order_purchase_timestamp) AS purchase_week,
          CASE
            WHEN o.order_delivered_customer_date IS NOT NULL AND o.order_delivered_customer_date > o.order_estimated_delivery_date THEN 1
            ELSE 0
          END AS is_delayed
        FROM olist_orders o
        JOIN olist_customers c ON o.customer_id = c.id
        JOIN olist_order_items i ON o.id = i.order_id
        JOIN olist_sellers s ON i.seller_id = s.id
        LEFT JOIN olist_products p ON i.product_id = p.id
        WHERE o.order_status = 'delivered'
          ${customerStatesFilter}
          ${categoriesFilter}
          ${dateFromFilter}
          ${dateToFilter}
        GROUP BY
          o.id, s.seller_state, c.customer_state, p.product_category_name,
          o.order_estimated_delivery_date, o.order_purchase_timestamp, o.order_delivered_carrier_date, o.order_delivered_customer_date
      )
      SELECT
        seller_state AS "sellerState",
        customer_state AS "customerState",
        product_category_name AS "primaryCategory",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_price)::float AS "totalPrice",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_freight)::float AS "totalFreight",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_weight_g)::float AS "totalWeightG",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_volume_cm3)::float AS "totalVolumeCm3",
        ROUND(AVG(item_count))::int AS "itemCount",
        ROUND(AVG(seller_count))::int AS "sellerCount",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY est_days)::float AS "estimatedDeliveryDays",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ship_days)::float AS "shippingWindowDays",
        MODE() WITHIN GROUP (ORDER BY purchase_dow)::int AS "purchaseDow",
        MODE() WITHIN GROUP (ORDER BY purchase_hour)::int AS "purchaseHour",
        MODE() WITHIN GROUP (ORDER BY purchase_month)::int AS "purchaseMonth",
        MODE() WITHIN GROUP (ORDER BY purchase_week)::int AS "purchaseWeek",
        COUNT(*)::int AS "sampleSize",
        AVG(is_delayed)::float AS "historicalLateRate"
      FROM order_aggregates
      GROUP BY seller_state, customer_state, product_category_name
      HAVING COUNT(*) >= ${minOrders}
      ${orderByClause}
      LIMIT ${limit};
    `;

    const rows = await this.prisma.$queryRaw<any[]>(rawQuery);

    return rows.map((r, idx) => ({
      scenarioId: `scen-db-${r.sellerState}-${r.customerState}-${r.primaryCategory || 'general'}-${idx + 1}`,
      sellerState: r.sellerState,
      customerState: r.customerState,
      primaryCategory: r.primaryCategory || null,
      totalPrice: Number(r.totalPrice || 100),
      totalFreight: Number(r.totalFreight || 25),
      totalWeightG: Number(r.totalWeightG || 500),
      totalVolumeCm3: Number(r.totalVolumeCm3 || 4500),
      itemCount: Number(r.itemCount || 1),
      sellerCount: Number(r.sellerCount || 1),
      estimatedDeliveryDays: Number(r.estimatedDeliveryDays || 10),
      shippingWindowDays: Number(r.shippingWindowDays || 4),
      routeDistanceKm: null,
      purchaseDow: Number(r.purchaseDow || 2),
      purchaseHour: Number(r.purchaseHour || 14),
      purchaseMonth: Number(r.purchaseMonth || 6),
      purchaseWeek: Number(r.purchaseWeek || 24),
      sellerPriorOrders: Number(r.sampleSize || 0),
      sellerPriorLateRate: Number(r.historicalLateRate || 0.08),
      routePriorOrders: Number(r.sampleSize || 0),
      routePriorLateRate: Number(r.historicalLateRate || 0.08),
      categoryPriorOrders: Number(r.sampleSize || 0),
      categoryPriorLateRate: Number(r.historicalLateRate || 0.08),
      sampleSize: Number(r.sampleSize || 0),
      historicalLateRate: Number(r.historicalLateRate || 0),
    }));
  }
}
