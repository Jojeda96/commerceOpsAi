import { InvestigationCapability } from './capability-agent-map';

export const REVIEW_TERMS =
  /\b(reseña(?:s)?|review(?:s)?|comentario(?:s)?|queja(?:s)?|opiniones?|cliente(?:s)?|satisfacci[oó]n|estrella(?:s)?|calificaci[oó]n)\b/i;

export const DAMAGE_TERMS =
  /\b(paquete(?:s)? dañado(?:s)?|producto(?:s)? dañado(?:s)?|roto(?:s)?|quebrado(?:s)?|embalaje|caja(?:s)? dañada(?:s)?)\b/i;

export const DELIVERY_COMPLAINT_TERMS =
  /\b(demora(?:s)?|retraso(?:s)?|atraso(?:s)?|entrega tard[ií]a|no lleg[oó]|no recibido)\b/i;

export const SALES_TERMS =
  /\b(venta(?:s)?|ingreso(?:s)?|facturaci[oó]n|revenue|gmv|ticket promedio|aov|m[eé]todo(?:s)? de pago|tarjeta de cr[eé]dito|boleto bancario)\b/i;

export const SELLER_TERMS =
  /\b(vendedor(?:es)?|seller(?:s)?|scorecard(?:s)?|riesgo operacional del vendedor|rendimiento acumulado del vendedor)\b/i;

export const CUSTOMER_RATING_TERMS =
  /\b(calificaci[oó]n promedio|rating promedio|puntuaci[oó]n promedio|estrellas promedio)\b/i;

export const OPERATIONAL_METRIC_TERMS =
  /\b(tasa de atraso|porcentaje de atraso|pedidos tard[ií]os|tiempo medio|promedio de entrega|sla|rendimiento log[ií]stico)\b/i;

export const GENERIC_LOGISTICS_TERMS =
  /\b(entrega|atraso|flete|env[ií]o|log[ií]stica|sla|retraso|interestatal|ruta(?:s)?)\b/i;

export function resolveQuestionCapabilities(
  text: string,
): InvestigationCapability[] {
  const capabilities = new Set<InvestigationCapability>();

  const asksAboutReviews = REVIEW_TERMS.test(text);
  const asksSales = SALES_TERMS.test(text);
  const asksSeller = SELLER_TERMS.test(text);
  const asksRating = CUSTOMER_RATING_TERMS.test(text);

  const asksAnomaly =
    /z[- ]?score|desviaci[oó]n|pico[s]? an[oó]malo[s]?|anomal[ií]a|outlier/i.test(
      text,
    );

  const asksPrediction =
    /probabilidad predictiva|predicci[oó]n|riesgo de atraso|predecir/i.test(
      text,
    );

  const asksGovernance =
    /gobernanza|estado del modelo|quality gate|runtime/i.test(text);

  const asksExplanation =
    /shap|factor(?:es)? de impacto|explicaci[oó]n del modelo|impacto de flete/i.test(
      text,
    );

  if (asksAnomaly) {
    capabilities.add('DESCRIPTIVE_LOGISTICS');
    capabilities.add('ANOMALY_DETECTION');
  }

  if (asksPrediction) {
    capabilities.add('HISTORICAL_CONTEXT');
    capabilities.add('ML_PREDICTION');
  }

  if (asksGovernance) {
    capabilities.add('MODEL_GOVERNANCE');
  }

  if (asksExplanation) {
    capabilities.add('LOCAL_EXPLANATION');
  }

  // Domain-specific intents have priority over generic logistics.
  if (asksSeller) {
    capabilities.add('SELLER_ANALYSIS');
  } else if (asksSales) {
    capabilities.add('SALES_ANALYSIS');
  } else if (asksRating) {
    capabilities.add('CUSTOMER_EXPERIENCE_ANALYSIS');
  } else if (asksAboutReviews) {
    capabilities.add('REVIEW_COMPLAINT_ANALYSIS');
  }

  // Add logistics only when logistics itself is the requested domain.
  const hasSpecificBusinessDomain =
    asksSeller || asksSales || asksRating || asksAboutReviews;

  if (
    (!hasSpecificBusinessDomain &&
      (OPERATIONAL_METRIC_TERMS.test(text) ||
        GENERIC_LOGISTICS_TERMS.test(text))) ||
    /tasa.*(atraso|retraso|entrega|global)/i.test(text)
  ) {
    capabilities.add('DESCRIPTIVE_LOGISTICS');
  }

  if (capabilities.size === 0) {
    capabilities.add('DESCRIPTIVE_LOGISTICS');
  }

  return Array.from(capabilities);
}
