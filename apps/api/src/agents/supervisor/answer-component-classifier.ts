import { AnswerComponent } from '@commerce-ops/shared-types';
import {
  REVIEW_TERMS,
  DAMAGE_TERMS,
  DELIVERY_COMPLAINT_TERMS,
} from './question-intent';

export function classifyAnswerComponents(question: string): AnswerComponent[] {
  const components = new Set<AnswerComponent>();
  const text = question.toLowerCase();

  const isReviewQuery = REVIEW_TERMS.test(text);

  if (isReviewQuery) {
    components.add('REVIEW_COMPLAINT_THEMES');
    components.add('REVIEW_RATING_CONTEXT');

    if (DELIVERY_COMPLAINT_TERMS.test(text)) {
      components.add('DELIVERY_DELAY_COMPLAINTS');
    }
    if (DAMAGE_TERMS.test(text)) {
      components.add('PACKAGE_DAMAGE_COMPLAINTS');
    }
  }

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

  if (!isReviewQuery && components.size === 0) {
    components.add('HISTORICAL_LOGISTICS_CONTEXT');
  }

  return Array.from(components);
}
