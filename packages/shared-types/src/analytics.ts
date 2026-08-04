import { AnalysisScope } from './index';

export type MetricUnit =
  | 'COUNT'
  | 'PERCENT'
  | 'PROPORTION'
  | 'DAYS'
  | 'ROBUST_Z_SCORE'
  | 'KILOMETERS'
  | 'BRL'
  | 'BOOLEAN'
  | 'SCORE';

export type AnalysisMethod =
  | 'DESCRIPTIVE_AGGREGATION'
  | 'ROUTE_AGGREGATION'
  | 'STAGE_BREAKDOWN'
  | 'ROBUST_Z_SCORE'
  | 'MODEL_INFERENCE'
  | 'LOCAL_SHAP'
  | 'LINEAR_CONTRIBUTION'
  | 'REVIEW_LEXICON_AGGREGATION'
  | 'SEMANTIC_REVIEW_RETRIEVAL'
  | 'RATING_DISTRIBUTION';

export interface EvidenceMetric {
  key: string;
  label: string;
  value: number;
  unit: MetricUnit;
  sampleSize?: number;
  sourcePath: string;
  aggregation?:
    | 'COUNT'
    | 'WEIGHTED_RATE'
    | 'UNWEIGHTED_MEAN'
    | 'MEDIAN'
    | 'MEAN'
    | 'ROBUST_Z_SCORE';
}

export interface NumericClaim {
  claimId: string;
  metricKey: string;
  value: number;
  unit: MetricUnit;
  evidenceId: string;
  sourcePath: string;
  tolerance: number;
  sampleSize?: number;
  renderedTextFragment?: string;
}

export interface MethodClaim {
  method: AnalysisMethod;
  evidenceId: string;
  toolName: string;
}

export interface ToolResultEnvelope<T> {
  status: 'AVAILABLE' | 'NO_DATA' | 'INSUFFICIENT_DATA' | 'UNAVAILABLE' | 'ERROR';
  reasonCode?: string;
  scopeHash: string;
  appliedScope: AnalysisScope;
  rowCount: number;
  sampleSize: number;
  methods: AnalysisMethod[];
  metrics: EvidenceMetric[];
  data: T | null;
  diagnostics?: Record<string, unknown>;
}

export interface DeliveryAggregateData {
  deliveredOrders: number;
  lateOrders: number;
  aggregateLateRatePct: number;
  averageDeliveryDays: number;
  averageDelayDays: number;
}

export interface RouteMetric {
  originState: string;
  destinationState: string;
  routeKey: string;
  deliveredOrders: number;
  lateOrders: number;
  lateRatePct: number;
  avgDeliveryDays: number;
}

export interface RouteDistributionData {
  eligibleRouteCount: number;
  displayedRouteCount: number;
  minOrdersPerRoute: number;
  weightedRouteLateRatePct: number;
  unweightedMeanRouteLateRatePct: number;
  medianRouteLateRatePct: number;
  routes: RouteMetric[];
}

export interface StageBreakdownData {
  analyzedOrders: number;
  excludedMissingCarrierDate: number;
  avgSellerPreparationDays: number;
  avgCarrierTransitDays: number;
  medianSellerPreparationDays: number;
  medianCarrierTransitDays: number;
  dominantStage: 'SELLER_PREPARATION' | 'CARRIER_TRANSIT' | 'BALANCED';
}

export const METRIC_LABELS: Record<string, string> = {
  'delivery.aggregate.delivered_orders': 'Total de pedidos entregados',
  'delivery.aggregate.late_orders': 'Total de pedidos entregados tarde',
  'delivery.aggregate.late_rate_pct': 'Tasa histórica agregada de atraso',
  'delivery.aggregate.avg_delivery_days': 'Tiempo medio de entrega (días)',
  'delivery.aggregate.avg_delay_days': 'Atraso medio en entregas tardías (días)',
  'delivery.routes.weighted_late_rate_pct': 'Tasa ponderada por pedidos entre rutas',
  'delivery.routes.unweighted_mean_late_rate_pct': 'Promedio simple de las tasas por ruta',
  'delivery.routes.median_late_rate_pct': 'Mediana de las tasas por ruta',
  'delivery.routes.eligible_route_count': 'Cantidad de rutas elegibles',
  'delivery.stage.avg_seller_preparation_days': 'Tiempo medio de preparación del vendedor (días)',
  'delivery.stage.avg_carrier_transit_days': 'Tiempo medio de tránsito del transportista (días)',
  'delivery.stage.analyzed_orders': 'Pedidos analizados en desglose por etapa',
  'anomaly.series.months_evaluated': 'Meses evaluados en serie temporal',
  'anomaly.series.median_monthly_late_rate_pct': 'Mediana mensual histórica de tasa de atraso',
  'anomaly.series.mad': 'Desviación absoluta respecto a la mediana (MAD)',
  'anomaly.series.threshold': 'Umbral absoluto de Z-Score robusto',
};
