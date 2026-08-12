import { AnswerComponent } from '@commerce-ops/shared-types';
import {
  REVIEW_TERMS,
  DAMAGE_TERMS,
  DELIVERY_COMPLAINT_TERMS,
  SALES_TERMS,
  SELLER_TERMS,
  CUSTOMER_RATING_TERMS,
} from './question-intent';

const RATING_METRIC_TERMS =
  /\b(calificaci[oó]n promedio|rating promedio|puntuaci[oó]n promedio|distribuci[oó]n de estrellas|promedio de estrellas)\b/i;

const TEMPORAL_COMPARISON_TERMS =
  /\b(respecto de|respecto a|comparad[oa] con|comparaci[oó]n|cambi[oó]|aument[oó]|disminuy[oó]|subi[oó]|baj[oó]|vari[oó])\b/i;

export function classifyAnswerComponents(question: string): AnswerComponent[] {
  const components = new Set<AnswerComponent>();
  const text = question.toLowerCase();

  if (
    /z[- ]?score|desviaci[oó]n|pico[s]? an[oó]malo[s]?|anomal[ií]a|outlier/i.test(
      text,
    )
  ) {
    components.add('HISTORICAL_LOGISTICS_CONTEXT');
    components.add('ANOMALY_DETECTION');
  }

  if (
    /probabilidad predictiva|predicci[oó]n|riesgo de atraso|predecir/i.test(
      text,
    )
  ) {
    components.add('HISTORICAL_LOGISTICS_CONTEXT');
    components.add('PREDICTION');
  }

  if (/gobernanza|estado del modelo|quality gate|runtime/i.test(text)) {
    components.add('MODEL_GOVERNANCE');
  }

  if (
    /shap|factor(?:es)? de impacto|explicaci[oó]n del modelo|impacto de flete/i.test(
      text,
    )
  ) {
    components.add('LOCAL_EXPLANATION');
  }

  if (SELLER_TERMS.test(text)) {
    components.add('TOP_SELLER_IDENTIFICATION');
    components.add('SELLER_CUMULATIVE_PERFORMANCE');
    components.add('SELLER_OPERATIONAL_RISK');
    return Array.from(components);
  }

  if (SALES_TERMS.test(text)) {
    if (/categor[ií]a(?:s)?.*(ingreso|venta)|ingreso.*categor/i.test(text)) {
      components.add('TOP_REVENUE_CATEGORIES');
    }

    if (
      /tarjeta de cr[eé]dito|boleto bancario|m[eé]todo(?:s)? de pago/i.test(
        text,
      )
    ) {
      components.add('PAYMENT_METHOD_COMPARISON');
    }

    return Array.from(components);
  }

  if (CUSTOMER_RATING_TERMS.test(text)) {
    components.add('REVIEW_RATING_CONTEXT');

    if (TEMPORAL_COMPARISON_TERMS.test(text)) {
      components.add('TEMPORAL_RATING_COMPARISON');
    }

    return Array.from(components);
  }

  const isReviewQuery = REVIEW_TERMS.test(text);

  if (isReviewQuery) {
    components.add('REVIEW_COMPLAINT_THEMES');

    // "1 estrella" is a filter, NOT a request for rating metrics.
    if (RATING_METRIC_TERMS.test(question)) {
      components.add('REVIEW_RATING_CONTEXT');
    }

    if (DELIVERY_COMPLAINT_TERMS.test(text)) {
      components.add('DELIVERY_DELAY_COMPLAINTS');
    }

    if (DAMAGE_TERMS.test(text)) {
      components.add('PACKAGE_DAMAGE_COMPLAINTS');
    }

    return Array.from(components);
  }

  if (/ruta(?:s)?.*(mayor|alta).*tasa|mayor tasa.*ruta/i.test(text)) {
    components.add('HISTORICAL_LOGISTICS_CONTEXT');
    components.add('ROUTE_RANKING_BY_LATE_RATE');
    return Array.from(components);
  }

  components.add('HISTORICAL_LOGISTICS_CONTEXT');

  if (TEMPORAL_COMPARISON_TERMS.test(text)) {
    components.add('TEMPORAL_LOGISTICS_COMPARISON');
  }

  return Array.from(components);
}
