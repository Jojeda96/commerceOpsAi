export type RecommendationDomain =
  | 'DELIVERY_MONITORING'
  | 'ANOMALY_INVESTIGATION'
  | 'PACKAGING_REVIEW'
  | 'CUSTOMER_COMMUNICATION'
  | 'SNAPSHOT_DATA_READINESS'
  | 'MODEL_VALIDATION'
  | 'LOCAL_EXPLANATION_ANALYSIS';

export function classifyRecommendationDomain(
  title: string,
  description: string,
): RecommendationDomain {
  const text = `${title} ${description}`.toLowerCase();

  if (
    text.includes('embalaje') ||
    text.includes('caja') ||
    text.includes('daño') ||
    text.includes('empaque') ||
    text.includes('packaging')
  ) {
    return 'PACKAGING_REVIEW';
  }

  if (
    text.includes('shap') ||
    text.includes('explicación local') ||
    text.includes('factor shap') ||
    text.includes('impacto local')
  ) {
    return 'LOCAL_EXPLANATION_ANALYSIS';
  }

  if (
    text.includes('z-score') ||
    text.includes('anomalía') ||
    text.includes('pico') ||
    text.includes('desviación') ||
    text.includes('investigar causa')
  ) {
    return 'ANOMALY_INVESTIGATION';
  }

  if (
    text.includes('snapshot') ||
    text.includes('datos de entrenamiento') ||
    text.includes('histórico de envíos') ||
    text.includes('calidad de datos')
  ) {
    return 'SNAPSHOT_DATA_READINESS';
  }

  if (
    text.includes('gobernanza') ||
    text.includes('validación del modelo') ||
    text.includes('despliegue del modelo')
  ) {
    return 'MODEL_VALIDATION';
  }

  if (
    text.includes('comunicar') ||
    text.includes('notificar') ||
    text.includes('cliente') ||
    text.includes('expectativa')
  ) {
    return 'CUSTOMER_COMMUNICATION';
  }

  return 'DELIVERY_MONITORING';
}
