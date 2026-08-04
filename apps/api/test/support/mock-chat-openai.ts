import { ChatOpenAI } from '@langchain/openai';

jest.mock('@langchain/openai', () => {
  return {
    ChatOpenAI: jest.fn().mockImplementation(() => {
      return {
        invoke: jest.fn().mockImplementation(async (promptInput: any) => {
          const promptStr =
            typeof promptInput === 'string'
              ? promptInput
              : JSON.stringify(promptInput);
          const lower = promptStr.toLowerCase();

          let content = '{}';

          if (
            lower.includes('critic') ||
            lower.includes('evalu') ||
            lower.includes('auditor')
          ) {
            content = JSON.stringify({
              decision: 'APPROVED',
              score: 95,
              feedback: 'Hallazgos con evidencias deterministas aprobados.',
              requestedAgents: [],
              requiredActions: [],
            });
          } else if (
            lower.includes('supervisor') ||
            lower.includes('capab') ||
            lower.includes('routing')
          ) {
            content = JSON.stringify({
              selectedAgents: ['CUSTOMER_EXPERIENCE'],
              tasks: [
                {
                  agentName: 'CUSTOMER_EXPERIENCE',
                  objective: 'Analizar quejas en reseñas de clientes.',
                },
              ],
              analysisScope: {},
              requiredCapabilities: ['REVIEW_COMPLAINT_ANALYSIS'],
              requiredAnswerComponents: [
                'REVIEW_COMPLAINT_THEMES',
                'DELIVERY_DELAY_COMPLAINTS',
                'PACKAGE_DAMAGE_COMPLAINTS',
              ],
            });
          } else if (
            lower.includes('strategy') ||
            lower.includes('estrategia') ||
            lower.includes('recomenda')
          ) {
            content = JSON.stringify({
              recommendations: [
                {
                  title: 'Auditar proceso de embalaje',
                  description:
                    'Auditar el proceso de embalaje y manipulación para evaluar si contribuye a las quejas observadas.',
                  priority: 'HIGH',
                  kind: 'HYPOTHESIS_TO_TEST',
                  expectedImpact: 'Mitigación de quejas por empaque dañado.',
                  assumptions: ['Auditoría física de almacenes.'],
                },
              ],
            });
          } else {
            content = JSON.stringify({
              decision: 'APPROVED',
              score: 90,
              feedback: 'Respuesta determinista de mock.',
            });
          }

          return {
            content,
            usage_metadata: {
              input_tokens: 100,
              output_tokens: 50,
            },
          };
        }),
      };
    }),
  };
});
