import { findUncoveredNumbers } from './rendered-number-coverage';
import { buildSalesFinding } from '../sales/build-sales-finding';
import { Evidence } from '@commerce-ops/shared-types';

describe('final rendered number coverage', () => {
  const baseEvidence = (
    id: string,
    toolName: string,
    resultSummary: string,
    metrics: any[] = [],
  ): Evidence => ({
    id,
    toolName,
    scopeHash: 'global-scope',
    parameters: {},
    resultSummary,
    metrics,
    generatedAt: new Date().toISOString(),
  });

  it('Sales category finding has no uncovered numbers', () => {
    const categoryData = [
      {
        category: 'beleza_saude',
        revenue: 5000,
        uniqueOrders: 100,
        averageOrderValue: 50,
      },
      {
        category: 'moveis_decoracao',
        revenue: 4000,
        uniqueOrders: 80,
        averageOrderValue: 50,
      },
      {
        category: 'informatica_acessorios',
        revenue: 3000,
        uniqueOrders: 60,
        averageOrderValue: 50,
      },
      {
        category: 'cama_mesa_banho',
        revenue: 2000,
        uniqueOrders: 40,
        averageOrderValue: 50,
      },
      {
        category: 'esporte_lazer',
        revenue: 1000,
        uniqueOrders: 20,
        averageOrderValue: 50,
      },
    ];

    const metrics = categoryData.flatMap((row) => [
      {
        key: `sales.category.${row.category}.revenue`,
        value: row.revenue,
        unit: 'BRL',
        sourcePath: `$.data[?(@.category=='${row.category}')].revenue`,
      },
      {
        key: `sales.category.${row.category}.orders`,
        value: row.uniqueOrders,
        unit: 'COUNT',
        sourcePath: `$.data[?(@.category=='${row.category}')].uniqueOrders`,
      },
      {
        key: `sales.category.${row.category}.aov`,
        value: row.averageOrderValue,
        unit: 'BRL',
        sourcePath: `$.data[?(@.category=='${row.category}')].averageOrderValue`,
      },
    ]);

    const catEvidence = baseEvidence(
      'ev-cat',
      'get_sales_by_category',
      JSON.stringify({ status: 'AVAILABLE', data: categoryData }),
      metrics,
    );

    const { finding } = buildSalesFinding({
      investigationId: 'inv-test',
      localAgentRunId: 'run-test',
      userQuestion: '¿Cuáles son las 5 categorías con mayores ingresos?',
      requiredComponents: ['TOP_REVENUE_CATEGORIES'],
      categoryEvidence: catEvidence,
    });

    const uncovered = findUncoveredNumbers(finding);
    expect(uncovered).toEqual([]);
  });

  it('Sales payment finding has no uncovered numbers', () => {
    const paymentData = {
      paymentMethods: [
        {
          paymentType: 'credit_card',
          totalValue: 9000,
          transactionCount: 75,
          avgPaymentValue: 120,
          avgInstallments: 3,
        },
        {
          paymentType: 'boleto',
          totalValue: 2000,
          transactionCount: 25,
          avgPaymentValue: 80,
          avgInstallments: 1,
        },
      ],
      comparison: {
        revenueDelta: 7000,
        revenueDeltaPct: 350,
        transactionDelta: 50,
        transactionDeltaPct: 200,
      },
    };

    const metrics = [
      {
        key: 'sales.payment.credit_card.total_value',
        value: 9000,
        unit: 'BRL',
        sourcePath:
          "$.data.paymentMethods[?(@.paymentType=='credit_card')].totalValue",
      },
      {
        key: 'sales.payment.credit_card.transaction_count',
        value: 75,
        unit: 'COUNT',
        sourcePath:
          "$.data.paymentMethods[?(@.paymentType=='credit_card')].transactionCount",
      },
      {
        key: 'sales.payment.boleto.total_value',
        value: 2000,
        unit: 'BRL',
        sourcePath:
          "$.data.paymentMethods[?(@.paymentType=='boleto')].totalValue",
      },
      {
        key: 'sales.payment.boleto.transaction_count',
        value: 25,
        unit: 'COUNT',
        sourcePath:
          "$.data.paymentMethods[?(@.paymentType=='boleto')].transactionCount",
      },
      {
        key: 'sales.payment.comparison.revenue_delta',
        value: 7000,
        unit: 'BRL',
        sourcePath: '$.data.comparison.revenueDelta',
      },
      {
        key: 'sales.payment.comparison.revenue_delta_pct',
        value: 350,
        unit: 'PERCENT',
        sourcePath: '$.data.comparison.revenueDeltaPct',
      },
      {
        key: 'sales.payment.comparison.transaction_delta',
        value: 50,
        unit: 'COUNT',
        sourcePath: '$.data.comparison.transactionDelta',
      },
      {
        key: 'sales.payment.comparison.transaction_delta_pct',
        value: 200,
        unit: 'PERCENT',
        sourcePath: '$.data.comparison.transactionDeltaPct',
      },
    ];

    const payEvidence = baseEvidence(
      'ev-pay',
      'get_sales_by_payment_method',
      JSON.stringify({ status: 'AVAILABLE', data: paymentData }),
      metrics,
    );

    const { finding } = buildSalesFinding({
      investigationId: 'inv-test',
      localAgentRunId: 'run-test',
      userQuestion: '¿Cuál es la diferencia entre tarjeta de crédito y boleto?',
      requiredComponents: ['PAYMENT_METHOD_COMPARISON'],
      paymentEvidence: payEvidence,
    });

    const uncovered = findUncoveredNumbers(finding);
    expect(uncovered).toEqual([]);
  });
});
