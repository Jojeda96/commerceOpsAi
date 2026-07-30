export const anomalyNoDateCase = {
  question:
    'Detecta desviaciones o picos anómalos en la tasa de retraso de entregas mediante Z-Score robusto.',
  requestFilters: {},
  expectedCapabilities: ['DESCRIPTIVE_LOGISTICS', 'ANOMALY_DETECTION'],
  expectedAgents: ['LOGISTICS', 'ANOMALY'],
  forbiddenAgents: ['DATA_SCIENCE'],
  expectedScope: {
    dateFrom: undefined,
    dateTo: undefined,
    interstateOnly: false,
  },
};
