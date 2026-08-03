export const INTERSTATE_PREDICTIVE_QUESTION =
  '¿Cuál es la probabilidad predictiva de atraso en envíos interestatales, el estado de gobernanza del modelo y los factores SHAP de mayor impacto?';

export const INTERSTATE_PREDICTIVE_EXPECTED_SCOPE = {
  interstateOnly: true,
  dateFrom: undefined,
  dateTo: undefined,
};

export const INTERSTATE_PREDICTIVE_EXPECTED_AGENTS = [
  'LOGISTICS',
  'DATA_SCIENCE',
];

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
