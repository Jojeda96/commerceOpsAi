import { classifyCapabilities } from '../../src/agents/supervisor/capability-classifier';
import { mapCapabilitiesToAgents } from '../../src/agents/supervisor/capability-agent-map';
import { classifyAnswerComponents } from '../../src/agents/supervisor/answer-component-classifier';
import { buildSalesFinding } from '../../src/agents/sales/build-sales-finding';

describe('E2E: Q5 Payment Method Comparison (Credit Card vs Boleto)', () => {
  const question =
    '¿Cuál es la diferencia en volumen de ventas e ingresos entre pagos con tarjeta de crédito y boleto bancario?';

  it('routes strictly to SALES agent and not LOGISTICS', () => {
    const caps = classifyCapabilities(question);
    const agents = mapCapabilitiesToAgents(caps);

    expect(agents).toEqual(['SALES']);
    expect(agents).not.toContain('LOGISTICS');
  });

  it('classifies PAYMENT_METHOD_COMPARISON component', () => {
    const components = classifyAnswerComponents(question);
    expect(components).toEqual(['PAYMENT_METHOD_COMPARISON']);
  });

  it('builds deterministic payment method finding with credit card and boleto deltas', () => {
    const mockEvidence: any = {
      id: 'ev-payment-1',
      resultSummary: JSON.stringify({
        status: 'AVAILABLE',
        data: {
          paymentMethods: [
            {
              paymentType: 'credit_card',
              totalValue: 500000,
              transactionCount: 4000,
              avgPaymentValue: 125,
              avgInstallments: 3,
            },
            {
              paymentType: 'boleto',
              totalValue: 200000,
              transactionCount: 1500,
              avgPaymentValue: 133.33,
              avgInstallments: 1,
            },
          ],
          comparison: {
            revenueDelta: 300000,
            revenueDeltaPct: 150,
            transactionDelta: 2500,
            transactionDeltaPct: 166.67,
          },
        },
      }),
    };

    const { finding, coverageItems } = buildSalesFinding({
      investigationId: 'inv-pay',
      localAgentRunId: 'run-pay',
      userQuestion: question,
      requiredComponents: ['PAYMENT_METHOD_COMPARISON'],
      paymentEvidence: mockEvidence,
    });

    expect(finding.description).toMatch(/credit_card|tarjeta/i);
    expect(finding.description).toMatch(/boleto/i);
    expect(finding.description).toMatch(/diferencia/i);
    expect(finding.numericClaims?.length).toBeGreaterThan(0);
    expect(coverageItems[0].status).toBe('ANSWERED');
  });
});
