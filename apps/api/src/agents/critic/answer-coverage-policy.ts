import {
  AnswerComponent,
  AnswerCoverageItem,
} from '@commerce-ops/shared-types';

export interface ComponentCoverageRule {
  component: AnswerComponent;
  requiredAgent?: string;
  requiredTool?: string;
  requiredMetricKeys?: string[];
  allowUnavailableWithReason: boolean;
  allowNoDataWithReason: boolean;
}

export const COMPONENT_COVERAGE_POLICIES: Record<
  AnswerComponent,
  ComponentCoverageRule
> = {
  REVIEW_COMPLAINT_THEMES: {
    component: 'REVIEW_COMPLAINT_THEMES',
    requiredAgent: 'CUSTOMER_EXPERIENCE',
    requiredTool: 'analyze_review_complaints',
    allowUnavailableWithReason: false,
    allowNoDataWithReason: true,
  },
  DELIVERY_DELAY_COMPLAINTS: {
    component: 'DELIVERY_DELAY_COMPLAINTS',
    requiredAgent: 'CUSTOMER_EXPERIENCE',
    requiredMetricKeys: [
      'reviews.topic.delivery_delay.count',
      'reviews.comments.total',
    ],
    allowUnavailableWithReason: false,
    allowNoDataWithReason: true,
  },
  PACKAGE_DAMAGE_COMPLAINTS: {
    component: 'PACKAGE_DAMAGE_COMPLAINTS',
    requiredAgent: 'CUSTOMER_EXPERIENCE',
    requiredMetricKeys: [
      'reviews.topic.package_damage.count',
      'reviews.comments.total',
    ],
    allowUnavailableWithReason: false,
    allowNoDataWithReason: true,
  },
  REVIEW_RATING_CONTEXT: {
    component: 'REVIEW_RATING_CONTEXT',
    requiredAgent: 'CUSTOMER_EXPERIENCE',
    requiredTool: 'get_rating_summary',
    allowUnavailableWithReason: true,
    allowNoDataWithReason: true,
  },
  HISTORICAL_LOGISTICS_CONTEXT: {
    component: 'HISTORICAL_LOGISTICS_CONTEXT',
    requiredAgent: 'LOGISTICS',
    allowUnavailableWithReason: true,
    allowNoDataWithReason: true,
  },
  MODEL_GOVERNANCE: {
    component: 'MODEL_GOVERNANCE',
    requiredAgent: 'DATA_SCIENCE',
    allowUnavailableWithReason: true,
    allowNoDataWithReason: true,
  },
  PREDICTION: {
    component: 'PREDICTION',
    requiredAgent: 'DATA_SCIENCE',
    allowUnavailableWithReason: true,
    allowNoDataWithReason: true,
  },
  LOCAL_EXPLANATION: {
    component: 'LOCAL_EXPLANATION',
    requiredAgent: 'DATA_SCIENCE',
    allowUnavailableWithReason: true,
    allowNoDataWithReason: true,
  },
  ANOMALY_DETECTION: {
    component: 'ANOMALY_DETECTION',
    requiredAgent: 'ANOMALY',
    allowUnavailableWithReason: false,
    allowNoDataWithReason: true,
  },
  ROUTE_RANKING_BY_LATE_RATE: {
    component: 'ROUTE_RANKING_BY_LATE_RATE',
    requiredAgent: 'LOGISTICS',
    requiredTool: 'get_delivery_performance_by_route',
    allowUnavailableWithReason: true,
    allowNoDataWithReason: true,
  },
  TEMPORAL_LOGISTICS_COMPARISON: {
    component: 'TEMPORAL_LOGISTICS_COMPARISON',
    requiredAgent: 'LOGISTICS',
    requiredTool: 'compare_delivery_summary_periods',
    allowUnavailableWithReason: true,
    allowNoDataWithReason: true,
  },
  TEMPORAL_RATING_COMPARISON: {
    component: 'TEMPORAL_RATING_COMPARISON',
    requiredAgent: 'CUSTOMER_EXPERIENCE',
    requiredTool: 'compare_rating_summary_periods',
    allowUnavailableWithReason: true,
    allowNoDataWithReason: true,
  },
  TOP_REVENUE_CATEGORIES: {
    component: 'TOP_REVENUE_CATEGORIES',
    requiredAgent: 'SALES',
    requiredTool: 'get_sales_by_category',
    allowUnavailableWithReason: true,
    allowNoDataWithReason: true,
  },
  PAYMENT_METHOD_COMPARISON: {
    component: 'PAYMENT_METHOD_COMPARISON',
    requiredAgent: 'SALES',
    requiredTool: 'get_sales_by_payment_method',
    allowUnavailableWithReason: true,
    allowNoDataWithReason: true,
  },
  TOP_SELLER_IDENTIFICATION: {
    component: 'TOP_SELLER_IDENTIFICATION',
    requiredAgent: 'SELLER_PERFORMANCE',
    requiredTool: 'get_top_seller_by_revenue',
    allowUnavailableWithReason: true,
    allowNoDataWithReason: true,
  },
  SELLER_CUMULATIVE_PERFORMANCE: {
    component: 'SELLER_CUMULATIVE_PERFORMANCE',
    requiredAgent: 'SELLER_PERFORMANCE',
    requiredTool: 'get_seller_scorecard',
    allowUnavailableWithReason: true,
    allowNoDataWithReason: true,
  },
  SELLER_OPERATIONAL_RISK: {
    component: 'SELLER_OPERATIONAL_RISK',
    requiredAgent: 'SELLER_PERFORMANCE',
    requiredTool: 'get_seller_scorecard',
    allowUnavailableWithReason: true,
    allowNoDataWithReason: true,
  },
};

export function validateAnswerCoverageItemPolicy(item: AnswerCoverageItem): {
  valid: boolean;
  error?: string;
} {
  const policy = COMPONENT_COVERAGE_POLICIES[item.component];
  if (!policy) return { valid: true };

  if (
    item.status === 'UNAVAILABLE_WITH_REASON' &&
    !policy.allowUnavailableWithReason
  ) {
    return {
      valid: false,
      error: `El componente ${item.component} no admite estado UNAVAILABLE_WITH_REASON.`,
    };
  }

  if (item.status === 'NO_DATA_WITH_REASON' && !policy.allowNoDataWithReason) {
    return {
      valid: false,
      error: `El componente ${item.component} no admite estado NO_DATA_WITH_REASON.`,
    };
  }

  if (
    (item.status === 'UNAVAILABLE_WITH_REASON' ||
      item.status === 'NO_DATA_WITH_REASON') &&
    !item.reasonCode
  ) {
    return {
      valid: false,
      error: `El componente ${item.component} requiere un reasonCode explicito en estado ${item.status}.`,
    };
  }

  return { valid: true };
}
