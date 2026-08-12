import { classifyCapabilities } from '../../src/agents/supervisor/capability-classifier';
import { mapCapabilitiesToAgents } from '../../src/agents/supervisor/capability-agent-map';
import { classifyAnswerComponents } from '../../src/agents/supervisor/answer-component-classifier';
import { buildSalesFinding } from '../../src/agents/sales/build-sales-finding';

describe('E2E: Q4 Sales Category Top Revenue & Average Order Value', () => {
  const question =
    '¿Cuáles son las 5 categorías que concentran mayores ingresos y cuál es su ticket promedio?';

  it('routes strictly to SALES agent and not LOGISTICS', () => {
    const caps = classifyCapabilities(question);
    const agents = mapCapabilitiesToAgents(caps);

    expect(agents).toEqual(['SALES']);
    expect(agents).not.toContain('LOGISTICS');
  });

  it('classifies TOP_REVENUE_CATEGORIES component', () => {
    const components = classifyAnswerComponents(question);
    expect(components).toEqual(['TOP_REVENUE_CATEGORIES']);
  });

  it('builds deterministic top revenue categories finding with numeric claims', () => {
    const mockEvidence: any = {
      id: 'ev-cat-1',
      resultSummary: JSON.stringify({
        status: 'AVAILABLE',
        data: [
          {
            category: 'beleza_saude',
            revenue: 500000,
            uniqueOrders: 5000,
            averageOrderValue: 100,
          },
          {
            category: 'moveis_decoracao',
            revenue: 400000,
            uniqueOrders: 4000,
            averageOrderValue: 100,
          },
          {
            category: 'informatica_acessorios',
            revenue: 300000,
            uniqueOrders: 3000,
            averageOrderValue: 100,
          },
          {
            category: 'cama_mesa_banho',
            revenue: 200000,
            uniqueOrders: 2000,
            averageOrderValue: 100,
          },
          {
            category: 'esporte_lazer',
            revenue: 100000,
            uniqueOrders: 1000,
            averageOrderValue: 100,
          },
        ],
      }),
    };

    const { finding, coverageItems } = buildSalesFinding({
      investigationId: 'inv-1',
      localAgentRunId: 'run-1',
      userQuestion: question,
      requiredComponents: ['TOP_REVENUE_CATEGORIES'],
      categoryEvidence: mockEvidence,
    });

    expect(finding.description).toMatch(/categor/i);
    expect(finding.description).toMatch(/ticket promedio/i);
    expect(finding.numericClaims?.length).toBeGreaterThan(0);
    expect(coverageItems[0].status).toBe('ANSWERED');
  });
});
