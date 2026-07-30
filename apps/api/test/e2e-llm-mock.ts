import { AgentName, CriticDecision } from '@commerce-ops/shared-types';

export const MOCK_SUPERVISOR_RESPONSE = {
  selectedAgents: ['LOGISTICS', 'DATA_SCIENCE'] as AgentName[],
  resolvedFilters: {
    customerStates: ['RJ'],
  },
  plan: [
    {
      agentName: 'LOGISTICS',
      objective: 'Analizar atrasos en entregas para Estado de Rio de Janeiro.',
    },
    {
      agentName: 'DATA_SCIENCE',
      objective: 'Evaluar riesgo predictivo de entrega en Rio de Janeiro.',
    },
  ],
};

export const MOCK_CRITIC_RESPONSE = {
  decision: 'APPROVED_WITH_WARNINGS' as CriticDecision,
  score: 88,
  feedback:
    'Hallazgos respaldados con evidencias verificables y advertencia de modelo experimental.',
  requestedAgents: [],
  requiredActions: [],
};
