import { AgentName } from '@commerce-ops/shared-types';

export interface AgentContract {
  name: AgentName;
  description: string;
  allowedTools: string[];
  permissions: {
    sales: 'READ' | 'WRITE' | 'NONE' | 'PARTIAL';
    logistics: 'READ' | 'WRITE' | 'NONE' | 'PARTIAL';
    reviews: 'READ' | 'WRITE' | 'NONE' | 'PARTIAL';
    sellers: 'READ' | 'WRITE' | 'NONE' | 'PARTIAL';
    ml: boolean;
    recommendations: boolean;
  };
}

export const AGENT_CONTRACTS: Record<AgentName, AgentContract> = {
  SUPERVISOR: {
    name: 'SUPERVISOR',
    description: 'Coordinador general del workflow multiagente.',
    allowedTools: [
      'get_dataset_coverage',
      'resolve_business_entities',
      'create_investigation_plan',
      'get_previous_investigations',
      'request_additional_analysis',
    ],
    permissions: {
      sales: 'READ',
      logistics: 'READ',
      reviews: 'READ',
      sellers: 'READ',
      ml: false,
      recommendations: false,
    },
  },
  SALES: {
    name: 'SALES',
    description: 'Especialista en análisis de ventas, ingresos y facturación.',
    allowedTools: [
      'get_revenue_summary',
      'get_sales_by_category',
      'compare_sales_periods',
      'get_payment_distribution',
      'get_regional_sales',
      'get_revenue_concentration',
      'get_sales_time_series',
    ],
    permissions: {
      sales: 'READ',
      logistics: 'PARTIAL',
      reviews: 'NONE',
      sellers: 'PARTIAL',
      ml: false,
      recommendations: false,
    },
  },
  LOGISTICS: {
    name: 'LOGISTICS',
    description: 'Especialista en entregas, tiempos de transporte y fletes.',
    allowedTools: [
      'get_delivery_summary',
      'compare_delivery_periods',
      'get_delivery_performance_by_state',
      'get_delivery_performance_by_category',
      'get_seller_processing_time',
      'get_carrier_transit_time',
      'get_freight_analysis',
      'get_delay_rating_relationship',
    ],
    permissions: {
      sales: 'PARTIAL',
      logistics: 'READ',
      reviews: 'PARTIAL',
      sellers: 'PARTIAL',
      ml: false,
      recommendations: false,
    },
  },
  CUSTOMER_EXPERIENCE: {
    name: 'CUSTOMER_EXPERIENCE',
    description: 'Especialista en calificaciones, reseñas y sentimiento.',
    allowedTools: [
      'get_rating_summary',
      'get_rating_by_dimension',
      'search_reviews_semantic',
      'classify_review_topics',
      'get_review_topic_distribution',
      'compare_review_topics',
      'get_representative_reviews',
      'get_sentiment_summary',
      'get_review_clusters',
    ],
    permissions: {
      sales: 'NONE',
      logistics: 'PARTIAL',
      reviews: 'READ',
      sellers: 'PARTIAL',
      ml: false,
      recommendations: false,
    },
  },
  SELLER_PERFORMANCE: {
    name: 'SELLER_PERFORMANCE',
    description: 'Especialista en rendimiento, riesgo y perfil de vendedores.',
    allowedTools: [
      'get_seller_scorecard',
      'compare_seller_to_peers',
      'get_seller_trend',
      'get_seller_review_topics',
      'get_seller_logistics_profile',
      'rank_sellers_by_risk',
      'find_seller_outliers',
    ],
    permissions: {
      sales: 'PARTIAL',
      logistics: 'PARTIAL',
      reviews: 'PARTIAL',
      sellers: 'READ',
      ml: false,
      recommendations: false,
    },
  },
  ANOMALY: {
    name: 'ANOMALY',
    description: 'Especialista en detección de anomalías y comportamientos atípicos.',
    allowedTools: [
      'detect_metric_anomalies',
      'detect_seller_anomalies',
      'detect_freight_outliers',
      'detect_category_shifts',
      'detect_review_topic_spikes',
      'explain_anomaly_features',
    ],
    permissions: {
      sales: 'READ',
      logistics: 'READ',
      reviews: 'READ',
      sellers: 'READ',
      ml: true,
      recommendations: false,
    },
  },
  DATA_SCIENCE: {
    name: 'DATA_SCIENCE',
    description: 'Especialista en modelos predictivos y machine learning.',
    allowedTools: [
      'predict_delivery_delay',
      'predict_low_rating',
      'predict_delivery_days',
      'get_model_metrics',
      'explain_prediction',
      'compare_prediction_scenarios',
      'check_model_drift',
    ],
    permissions: {
      sales: 'PARTIAL',
      logistics: 'PARTIAL',
      reviews: 'PARTIAL',
      sellers: 'PARTIAL',
      ml: true,
      recommendations: false,
    },
  },
  STRATEGY: {
    name: 'STRATEGY',
    description: 'Especialista en generación y priorización de recomendaciones empresariales.',
    allowedTools: [
      'get_action_catalog',
      'estimate_action_scope',
      'estimate_historical_impact',
      'prioritize_recommendations',
      'validate_recommendation_evidence',
    ],
    permissions: {
      sales: 'NONE',
      logistics: 'NONE',
      reviews: 'NONE',
      sellers: 'NONE',
      ml: false,
      recommendations: true,
    },
  },
  CRITIC: {
    name: 'CRITIC',
    description: 'Validador crítico de evidencia, consistencia y calidad.',
    allowedTools: [
      'validate_finding_evidence',
      'recalculate_metric',
      'compare_agent_findings',
      'check_sample_size',
      'check_period_comparability',
      'check_causal_language',
      'request_followup_analysis',
      'score_investigation_quality',
    ],
    permissions: {
      sales: 'READ',
      logistics: 'READ',
      reviews: 'READ',
      sellers: 'READ',
      ml: true,
      recommendations: true,
    },
  },
};
