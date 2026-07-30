import { InvestigationCapability } from './capability-agent-map';

export function classifyCapabilities(question: string): InvestigationCapability[] {
  const capabilities = new Set<InvestigationCapability>();
  const text = question.toLowerCase();

  // Anomaly regex pattern
  if (/z[- ]?score|desviaci[oó]n|pico[s]? an[oó]malo[s]?|anomal[ií]a|outlier/i.test(text)) {
    capabilities.add('DESCRIPTIVE_LOGISTICS');
    capabilities.add('ANOMALY_DETECTION');
  }

  // Predictive ML & Governance & SHAP regex patterns
  if (/probabilidad predictiva|predicci[oó]n|riesgo de atraso|predecir/i.test(text)) {
    capabilities.add('HISTORICAL_CONTEXT');
    capabilities.add('ML_PREDICTION');
  }

  if (/gobernanza|estado del modelo|quality gate|runtime/i.test(text)) {
    capabilities.add('MODEL_GOVERNANCE');
  }

  if (/shap|factor(?:es)? de impacto|explicaci[oó]n del modelo|impacto de flete/i.test(text)) {
    capabilities.add('LOCAL_EXPLANATION');
  }

  // General logistics pattern if not already set
  if (
    /entrega|atraso|flete|env[ií]o|log[ií]stica|sla|retraso|interestatal/i.test(text) &&
    capabilities.size === 0
  ) {
    capabilities.add('DESCRIPTIVE_LOGISTICS');
  }

  // Default fallback if no specific keywords matched
  if (capabilities.size === 0) {
    capabilities.add('DESCRIPTIVE_LOGISTICS');
  }

  return Array.from(capabilities);
}
