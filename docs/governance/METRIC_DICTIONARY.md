# Metric Dictionary — CommerceOps AI V4.2

This document specifies the canonical mathematical definitions, units, aggregations, and interpretation rules for every metric calculated and displayed across CommerceOps AI.

---

## 1. Logistics & Delivery Metrics

### `aggregateLateRatePct`
- **Key**: `delivery.aggregate.late_rate_pct`
- **Label**: Tasa histórica agregada de atraso
- **Formula**: `(total_late_orders / total_delivered_orders) * 100`
- **Unit**: `PERCENT`
- **Aggregation**: `WEIGHTED_RATE`
- **Scope**: Applied over all delivered orders in `AnalysisScope`.
- **Interpretation**: Global percentage of delivered orders where actual customer delivery date exceeded estimated delivery date.

### `weightedRouteLateRatePct`
- **Key**: `delivery.routes.weighted_late_rate_pct`
- **Label**: Tasa ponderada por pedidos entre rutas
- **Formula**: `(sum_late_orders_all_routes / sum_delivered_orders_all_routes) * 100`
- **Unit**: `PERCENT`
- **Aggregation**: `WEIGHTED_RATE`
- **Parity Rule**: Equals `aggregateLateRatePct` when evaluated over the same set of eligible orders.

### `unweightedMeanRouteLateRatePct`
- **Key**: `delivery.routes.unweighted_mean_late_rate_pct`
- **Label**: Promedio simple de las tasas por ruta
- **Formula**: `mean(route_late_rate_pct_for_each_eligible_route)`
- **Unit**: `PERCENT`
- **Aggregation**: `UNWEIGHTED_MEAN`
- **Caution**: Gives equal weight to every route regardless of order volume. Must NEVER be labeled as the overall late delivery rate.

### `medianRouteLateRatePct`
- **Key**: `delivery.routes.median_late_rate_pct`
- **Label**: Mediana de las tasas por ruta
- **Formula**: `median(route_late_rate_pct_for_each_eligible_route)`
- **Unit**: `PERCENT`
- **Aggregation**: `MEDIAN`

---

## 2. Stage Breakdown Metrics

### `avgSellerPreparationDays`
- **Key**: `delivery.stage.avg_seller_preparation_days`
- **Formula**: `mean(order_delivered_carrier_date - order_purchase_timestamp)` in days.
- **Unit**: `DAYS`

### `avgCarrierTransitDays`
- **Key**: `delivery.stage.avg_carrier_transit_days`
- **Formula**: `mean(order_delivered_customer_date - order_delivered_carrier_date)` in days.
- **Unit**: `DAYS`

---

## 3. Anomaly Detection Metrics

### `robustZScore`
- **Key**: `anomaly.point.<MONTH>.robust_z_score`
- **Formula**: `0.6745 * (month_late_rate - median_monthly_rate) / MAD`
- **Unit**: `ROBUST_Z_SCORE`
- **Threshold**: Anomaly flag triggered when `|Z| >= 3.0`.
