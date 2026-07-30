export const interstatePredictionCase = {
  question:
    '¿Cuál es la probabilidad predictiva de atraso en envíos interestatales, el estado de gobernanza del modelo y los factores SHAP de mayor impacto?',
  requestFilters: {},
  expectedCapabilities: [
    'HISTORICAL_CONTEXT',
    'ML_PREDICTION',
    'MODEL_GOVERNANCE',
    'LOCAL_EXPLANATION',
  ],
  expectedAgents: ['LOGISTICS', 'DATA_SCIENCE'],
  expectedScope: {
    dateFrom: undefined,
    dateTo: undefined,
    interstateOnly: true,
  },
};
