import { classifyCapabilities } from '../../src/agents/supervisor/capability-classifier';
import { mapCapabilitiesToAgents } from '../../src/agents/supervisor/capability-agent-map';
import { classifyAnswerComponents } from '../../src/agents/supervisor/answer-component-classifier';

describe('E2E: Q1 Seller Top Revenue & Risk Scorecard', () => {
  const question =
    'Evalúa el riesgo operacional y rendimiento acumulado del vendedor con mayores ventas.';

  it('routes strictly to SELLER_PERFORMANCE agent', () => {
    const caps = classifyCapabilities(question);
    const agents = mapCapabilitiesToAgents(caps);

    expect(agents).toEqual(['SELLER_PERFORMANCE']);
    expect(agents).not.toContain('LOGISTICS');
  });

  it('classifies required seller answer components', () => {
    const components = classifyAnswerComponents(question);
    expect(components).toContain('TOP_SELLER_IDENTIFICATION');
    expect(components).toContain('SELLER_CUMULATIVE_PERFORMANCE');
    expect(components).toContain('SELLER_OPERATIONAL_RISK');
  });

  it('builds grounded numeric claims for seller scorecard', () => {
    const mockFinding = {
      description:
        'Vendedor con mayores ventas: seller-1\nIngresos acumulados: R$ 100.000,00\nGMV: R$ 120.000,00\nPedidos únicos: 500\nItems vendidos: 600\nTasa de atraso: 5.2%\nRating promedio: 4.5\nRiesgo operacional: LOW',
      numericClaims: [
        { metricKey: 'seller.revenue', value: 100000 },
        { metricKey: 'seller.unique_orders', value: 500 },
      ],
    };

    expect(mockFinding.description).toMatch(/vendedor/i);
    expect(mockFinding.description).toMatch(/ingresos/i);
    expect(mockFinding.description).toMatch(/riesgo/i);
    expect(mockFinding.numericClaims.length).toBeGreaterThan(0);
  });
});
