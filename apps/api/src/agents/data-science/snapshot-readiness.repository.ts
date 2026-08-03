import { PrismaClient, Prisma } from '@prisma/client';
import { ScenarioDiagnostics } from './scenario-readiness.schema';
import { ScenarioQueryResult } from './scenario-query-result';
import {
  FeatureSnapshotFilters,
  ScenarioSnapshotRow,
} from './delivery-feature-snapshots.repository';

export class SnapshotReadinessRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async evaluateReadinessAndQuery(
    options: FeatureSnapshotFilters = {},
  ): Promise<ScenarioQueryResult> {
    const minOrders = options.minOrders || 5;
    const limit = options.limit || 3;

    let tableExists = false;
    let totalSnapshotRows = 0;
    let minPurchaseDate: string | null = null;
    let maxPurchaseDate: string | null = null;
    const latestGeneratedAt: string | null = null;
    const featureContractVersion: string | null = null;

    try {
      const checkTable: any[] = await this.prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'delivery_feature_snapshots'
        ) as "exists";
      `;
      tableExists = Boolean(checkTable[0]?.exists);
    } catch {
      tableExists = false;
    }

    if (!tableExists) {
      return {
        status: 'UNAVAILABLE',
        reasonCode: 'SNAPSHOT_TABLE_MISSING',
        diagnostics: {
          tableExists: false,
          totalSnapshotRows: 0,
          minPurchaseDate: null,
          maxPurchaseDate: null,
          latestGeneratedAt: null,
          featureContractVersion: null,
          rowsInRequestedScope: 0,
          rawOrdersInRequestedScope: 0,
          distinctGroupsBeforeMinimum: 0,
          groupsAfterMinimum: 0,
          rowsExcludedForInvalidFeatures: 0,
        },
      };
    }

    try {
      const stats: any[] = await this.prisma.$queryRaw`
        SELECT 
          COUNT(*)::int as "total",
          MIN(purchase_date)::text as "minDate",
          MAX(purchase_date)::text as "maxDate"
        FROM delivery_feature_snapshots;
      `;

      totalSnapshotRows = Number(stats[0]?.total || 0);
      minPurchaseDate = stats[0]?.minDate || null;
      maxPurchaseDate = stats[0]?.maxDate || null;
    } catch (err) {
      return {
        status: 'UNAVAILABLE',
        reasonCode: 'SNAPSHOT_QUERY_FAILED',
        diagnostics: {
          tableExists: true,
          totalSnapshotRows: 0,
          minPurchaseDate: null,
          maxPurchaseDate: null,
          latestGeneratedAt: null,
          featureContractVersion: null,
          rowsInRequestedScope: 0,
          rawOrdersInRequestedScope: 0,
          distinctGroupsBeforeMinimum: 0,
          groupsAfterMinimum: 0,
          rowsExcludedForInvalidFeatures: 0,
        },
      };
    }

    if (totalSnapshotRows === 0) {
      return {
        status: 'UNAVAILABLE',
        reasonCode: 'SNAPSHOT_TABLE_EMPTY',
        diagnostics: {
          tableExists: true,
          totalSnapshotRows: 0,
          minPurchaseDate,
          maxPurchaseDate,
          latestGeneratedAt: null,
          featureContractVersion: null,
          rowsInRequestedScope: 0,
          rawOrdersInRequestedScope: 0,
          distinctGroupsBeforeMinimum: 0,
          groupsAfterMinimum: 0,
          rowsExcludedForInvalidFeatures: 0,
        },
      };
    }

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

    const countScopeQuery = Prisma.sql`
      SELECT COUNT(*)::int as "scopeCount"
      FROM delivery_feature_snapshots
      WHERE 1=1
        ${customerStatesFilter}
        ${sellerStatesFilter}
        ${categoriesFilter}
        ${dateFromFilter}
        ${dateToFilter}
        ${interstateFilter};
    `;

    const scopeRes: any[] = await this.prisma.$queryRaw(countScopeQuery);
    const rowsInRequestedScope = Number(scopeRes[0]?.scopeCount || 0);

    if (rowsInRequestedScope === 0) {
      return {
        status: 'UNAVAILABLE',
        reasonCode: 'NO_ROWS_IN_SCOPE',
        diagnostics: {
          tableExists: true,
          totalSnapshotRows,
          minPurchaseDate,
          maxPurchaseDate,
          latestGeneratedAt,
          featureContractVersion,
          rowsInRequestedScope: 0,
          rawOrdersInRequestedScope: 0,
          distinctGroupsBeforeMinimum: 0,
          groupsAfterMinimum: 0,
          rowsExcludedForInvalidFeatures: 0,
        },
      };
    }

    const groupsQuery = Prisma.sql`
      SELECT 
        COUNT(DISTINCT (primary_seller_state || '_' || customer_state || '_' || primary_category))::int as "distinctGroups",
        COUNT(*) FILTER (WHERE cnt >= ${minOrders})::int as "groupsAfterMin"
      FROM (
        SELECT primary_seller_state, customer_state, primary_category, COUNT(*)::int as cnt
        FROM delivery_feature_snapshots
        WHERE 1=1
          ${customerStatesFilter}
          ${sellerStatesFilter}
          ${categoriesFilter}
          ${dateFromFilter}
          ${dateToFilter}
          ${interstateFilter}
        GROUP BY primary_seller_state, customer_state, primary_category
      ) sub;
    `;

    const groupsRes: any[] = await this.prisma.$queryRaw(groupsQuery);
    const distinctGroupsBeforeMinimum = Number(
      groupsRes[0]?.distinctGroups || 0,
    );
    const groupsAfterMinimum = Number(groupsRes[0]?.groupsAfterMin || 0);

    if (groupsAfterMinimum === 0) {
      return {
        status: 'UNAVAILABLE',
        reasonCode: 'NO_GROUP_MEETS_MINIMUM_SAMPLE',
        diagnostics: {
          tableExists: true,
          totalSnapshotRows,
          minPurchaseDate,
          maxPurchaseDate,
          latestGeneratedAt,
          featureContractVersion,
          rowsInRequestedScope,
          rawOrdersInRequestedScope: rowsInRequestedScope,
          distinctGroupsBeforeMinimum,
          groupsAfterMinimum: 0,
          rowsExcludedForInvalidFeatures: 0,
        },
      };
    }

    const selectionMethod = options.selectionMethod || 'REPRESENTATIVE_MEDIAN';
    const orderByClause =
      selectionMethod === 'HIGH_RISK_HISTORICAL'
        ? Prisma.sql`ORDER BY AVG(CASE WHEN is_delayed THEN 1.0 ELSE 0.0 END) DESC, COUNT(*) DESC`
        : Prisma.sql`ORDER BY COUNT(*) DESC, AVG(CASE WHEN is_delayed THEN 1.0 ELSE 0.0 END) DESC`;

    const fetchQuery = Prisma.sql`
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

    const rows = await this.prisma.$queryRaw<any[]>(fetchQuery);

    const scenarios = rows.map((r, idx) => ({
      scenarioId: `scen-snap-${r.primarySellerState}-${r.customerState}-${r.primaryCategory}-${idx + 1}`,
      sellerState: r.primarySellerState,
      customerState: r.customerState,
      category: r.primaryCategory,
      observationCount: Number(r.sampleSize),
      historicalLateRatePct:
        Math.round(Number(r.historicalLateRate) * 1000) / 10,
      features: {
        total_price: Number(r.totalPrice),
        total_freight: Number(r.totalFreight),
        total_weight_g: Number(r.totalWeightG),
        total_volume_cm3: Number(r.totalVolumeCm3),
        item_count: Number(r.itemCount),
        seller_count: Number(r.sellerCount),
        estimated_delivery_days: Number(r.estimatedDeliveryDays),
        shipping_window_days: Number(r.shippingWindowDays),
        route_distance_km:
          r.routeDistanceKm !== null ? Number(r.routeDistanceKm) : 500,
        purchase_dow: Number(r.purchaseDow),
        purchase_hour: Number(r.purchaseHour),
        purchase_month: Number(r.purchaseMonth),
        purchase_week: Number(r.purchaseWeek),
        seller_prior_orders: Number(r.sellerPriorOrders),
        seller_prior_late_rate_smoothed: Number(r.sellerPriorLateRateSmoothed),
        route_prior_orders: Number(r.routePriorOrders),
        route_prior_late_rate_smoothed: Number(r.routePriorLateRateSmoothed),
        category_prior_orders: Number(r.categoryPriorOrders),
        category_prior_late_rate_smoothed: Number(
          r.categoryPriorLateRateSmoothed,
        ),
      },
    }));

    return {
      status: 'AVAILABLE',
      scenarios,
      diagnostics: {
        tableExists: true,
        totalSnapshotRows,
        minPurchaseDate,
        maxPurchaseDate,
        latestGeneratedAt,
        featureContractVersion,
        rowsInRequestedScope,
        rawOrdersInRequestedScope: rowsInRequestedScope,
        distinctGroupsBeforeMinimum,
        groupsAfterMinimum,
        rowsExcludedForInvalidFeatures: 0,
      },
    };
  }
}
