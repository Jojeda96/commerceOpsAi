import { classifyCapabilities } from './capability-classifier';
import { mapCapabilitiesToAgents } from './capability-agent-map';
import { classifyAnswerComponents } from './answer-component-classifier';

describe('Final portfolio capability routing', () => {
  const cases = [
    {
      q: 'Evalúa el riesgo operacional y rendimiento acumulado del vendedor con mayores ventas.',
      agents: ['SELLER_PERFORMANCE'],
      components: [
        'TOP_SELLER_IDENTIFICATION',
        'SELLER_CUMULATIVE_PERFORMANCE',
        'SELLER_OPERATIONAL_RISK',
      ],
    },
    {
      q: '¿Cuáles son las 5 categorías que concentran mayores ingresos y cuál es su ticket promedio?',
      agents: ['SALES'],
      components: ['TOP_REVENUE_CATEGORIES'],
    },
    {
      q: '¿Cuál es la diferencia en volumen de ventas e ingresos entre pagos con tarjeta de crédito y boleto bancario?',
      agents: ['SALES'],
      components: ['PAYMENT_METHOD_COMPARISON'],
    },
    {
      q: '¿Cómo cambió la calificación promedio de los clientes en febrero de 2018 respecto de enero de 2018?',
      agents: ['CUSTOMER_EXPERIENCE'],
      components: ['REVIEW_RATING_CONTEXT', 'TEMPORAL_RATING_COMPARISON'],
    },
    {
      q: '¿Cuáles son las quejas principales en las reseñas de 1 estrella sobre la categoría informatica_acessorios?',
      agents: ['CUSTOMER_EXPERIENCE'],
      components: ['REVIEW_COMPLAINT_THEMES'],
    },
    {
      q: '¿Cuáles son las rutas interestatales con mayor tasa de atrasos en entregas?',
      agents: ['LOGISTICS'],
      components: [
        'HISTORICAL_LOGISTICS_CONTEXT',
        'ROUTE_RANKING_BY_LATE_RATE',
      ],
    },
  ];

  for (const c of cases) {
    it(c.q, () => {
      const caps = classifyCapabilities(c.q);
      const agents = mapCapabilitiesToAgents(caps);
      const components = classifyAnswerComponents(c.q);

      expect(agents).toEqual(c.agents);

      for (const expected of c.components) {
        expect(components).toContain(expected);
      }
    });
  }
});
