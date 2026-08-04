import { InvestigationCapability } from './capability-agent-map';

export const REVIEW_TERMS =
  /\b(reseña(?:s)?|review(?:s)?|comentario(?:s)?|queja(?:s)?|opiniones?|cliente(?:s)?|satisfacci[oó]n|estrella(?:s)?|calificaci[oó]n)\b/i;

export const DAMAGE_TERMS =
  /\b(paquete(?:s)? dañado(?:s)?|producto(?:s)? dañado(?:s)?|roto(?:s)?|quebrado(?:s)?|embalaje|caja(?:s)? dañada(?:s)?)\b/i;

export const DELIVERY_COMPLAINT_TERMS =
  /\b(demora(?:s)?|retraso(?:s)?|atraso(?:s)?|entrega tard[ií]a|no lleg[oó]|no recibido)\b/i;

export const OPERATIONAL_METRIC_TERMS =
  /\b(tasa|porcentaje|volumen|cantidad de pedidos|pedidos tard[ií]os|tiempo medio|promedio de entrega|sla|rendimiento log[ií]stico)\b/i;

export const GENERIC_LOGISTICS_TERMS =
  /\b(entrega|atraso|flete|env[ií]o|log[ií]stica|sla|retraso|interestatal)\b/i;

export function resolveQuestionCapabilities(
  text: string,
): InvestigationCapability[] {
  const capabilities = new Set<InvestigationCapability>();

  const asksAboutReviews = REVIEW_TERMS.test(text);
  const asksOperationalMetric = OPERATIONAL_METRIC_TERMS.test(text);

  // Anomaly regex pattern
  if (
    /z[- ]?score|desviaci[oó]n|pico[s]? an[oó]malo[s]?|anomal[ií]a|outlier/i.test(
      text,
    )
  ) {
    capabilities.add('DESCRIPTIVE_LOGISTICS');
    capabilities.add('ANOMALY_DETECTION');
  }

  // Predictive ML & Governance & SHAP regex patterns
  if (
    /probabilidad predictiva|predicci[oó]n|riesgo de atraso|predecir/i.test(
      text,
    )
  ) {
    capabilities.add('HISTORICAL_CONTEXT');
    capabilities.add('ML_PREDICTION');
  }

  if (/gobernanza|estado del modelo|quality gate|runtime/i.test(text)) {
    capabilities.add('MODEL_GOVERNANCE');
  }

  if (
    /shap|factor(?:es)? de impacto|explicaci[oó]n del modelo|impacto de flete/i.test(
      text,
    )
  ) {
    capabilities.add('LOCAL_EXPLANATION');
  }

  // Priority Rule for Customer Experience / Reviews
  if (asksAboutReviews) {
    capabilities.add('REVIEW_COMPLAINT_ANALYSIS');
  }

  if (asksOperationalMetric) {
    capabilities.add('DESCRIPTIVE_LOGISTICS');
  }

  if (!asksAboutReviews && GENERIC_LOGISTICS_TERMS.test(text)) {
    capabilities.add('DESCRIPTIVE_LOGISTICS');
  }

  if (capabilities.size === 0) {
    capabilities.add('DESCRIPTIVE_LOGISTICS');
  }

  return Array.from(capabilities);
}
