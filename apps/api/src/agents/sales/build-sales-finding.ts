import {
  Finding,
  Evidence,
  AnswerCoverageItem,
  AnswerComponent,
  NumericClaim,
  MethodClaim,
} from '@commerce-ops/shared-types';

export function buildSalesFinding(input: {
  investigationId: string;
  localAgentRunId?: string;
  userQuestion: string;
  requiredComponents: AnswerComponent[];
  categoryEvidence?: Evidence;
  paymentEvidence?: Evidence;
  summaryEvidence?: Evidence;
}): { finding: Finding; coverageItems: AnswerCoverageItem[] } {
  const {
    investigationId,
    localAgentRunId,
    requiredComponents,
    categoryEvidence,
    paymentEvidence,
  } = input;

  const numericClaims: NumericClaim[] = [];
  const methodClaims: MethodClaim[] = [];
  const evidenceIds: string[] = [];
  const coverageItems: AnswerCoverageItem[] = [];

  let title = 'Análisis Comercial y de Ventas';
  let description = 'Se analizó la facturación y comportamiento comercial.';

  if (
    requiredComponents.includes('TOP_REVENUE_CATEGORIES') &&
    categoryEvidence
  ) {
    evidenceIds.push(categoryEvidence.id);
    methodClaims.push({
      method: 'CATEGORY_REVENUE_AGGREGATION',
      evidenceId: categoryEvidence.id,
      toolName: 'get_sales_by_category',
    });

    // Parse the new envelope format
    let catData: any[] = [];
    try {
      const parsed = JSON.parse(categoryEvidence.resultSummary || '{}');

      catData = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.data)
          ? parsed.data
          : [];
    } catch {
      catData = [];
    }

    const top5 = catData.slice(0, 5);
    title = 'Top Categorías por Ingresos';

    const lines: string[] = ['Categorías con mayores ingresos:'];

    top5.forEach((c) => {
      const slug = c.category;
      const rev = Number(c.revenue || 0);
      const orders = Number(c.uniqueOrders || 0);
      const aov = Number(c.averageOrderValue || 0);

      lines.push(
        `• ${slug} — R$ ${rev.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
        })} — ${orders} pedidos — ticket promedio R$ ${aov.toLocaleString(
          'pt-BR',
          { minimumFractionDigits: 2 },
        )}`,
      );

      numericClaims.push({
        claimId: `claim-cat-${slug}-rev`,
        metricKey: `sales.category.${slug}.revenue`,
        value: rev,
        unit: 'BRL',
        evidenceId: categoryEvidence.id,
        sourcePath: `$.data[?(@.category=='${slug}')].revenue`,
        tolerance: 0.01,
      });

      numericClaims.push({
        claimId: `claim-cat-${slug}-orders`,
        metricKey: `sales.category.${slug}.orders`,
        value: orders,
        unit: 'COUNT',
        evidenceId: categoryEvidence.id,
        sourcePath: `$.data[?(@.category=='${slug}')].uniqueOrders`,
        tolerance: 0,
      });

      numericClaims.push({
        claimId: `claim-cat-${slug}-aov`,
        metricKey: `sales.category.${slug}.aov`,
        value: aov,
        unit: 'BRL',
        evidenceId: categoryEvidence.id,
        sourcePath: `$.data[?(@.category=='${slug}')].averageOrderValue`,
        tolerance: 0.01,
      });
    });

    description = lines.join('\n');

    const hasFiveCategories = top5.length === 5;

    coverageItems.push({
      component: 'TOP_REVENUE_CATEGORIES',
      status: hasFiveCategories ? 'ANSWERED' : 'NO_DATA_WITH_REASON',
      reasonCode: hasFiveCategories
        ? undefined
        : 'FEWER_THAN_FIVE_REVENUE_CATEGORIES',
      evidenceIds: [categoryEvidence.id],
    });
  } else if (
    requiredComponents.includes('PAYMENT_METHOD_COMPARISON') &&
    paymentEvidence
  ) {
    evidenceIds.push(paymentEvidence.id);
    methodClaims.push({
      method: 'PAYMENT_METHOD_AGGREGATION',
      evidenceId: paymentEvidence.id,
      toolName: 'get_sales_by_payment_method',
    });

    // Parse the new envelope format
    let payEnvelope: any = {};
    try {
      payEnvelope = JSON.parse(paymentEvidence.resultSummary || '{}');
    } catch {
      payEnvelope = {};
    }

    const payData = payEnvelope?.data?.paymentMethods || [];

    const comparison = payEnvelope?.data?.comparison || null;

    const credit = payData.find((p: any) => p.paymentType === 'credit_card');

    const boleto = payData.find((p: any) => p.paymentType === 'boleto');

    // If missing core data, return early with UNAVAILABLE
    if (!credit || !boleto || !comparison) {
      const finding: Finding = {
        id: `finding-sales-${Date.now()}`,
        investigationId,
        localAgentRunId,
        agent: 'SALES',
        agentName: 'SALES',
        title: 'Comparación de Métodos de Pago',
        description:
          'No fue posible comparar tarjeta de crédito y boleto bancario porque falta uno de los métodos en el scope analizado.',
        findingType: 'SALES_ANALYSIS',
        evidenceIds: [paymentEvidence.id],
        numericClaims: [],
        methodClaims,
        auditStatus: 'PENDING',
        operationalStatus: 'UNAVAILABLE',
        createdAt: new Date().toISOString(),
      };

      return {
        finding,
        coverageItems: [
          {
            component: 'PAYMENT_METHOD_COMPARISON',
            status: 'NO_DATA_WITH_REASON',
            reasonCode: 'PAYMENT_METHOD_PAIR_NOT_AVAILABLE',
            evidenceIds: [paymentEvidence.id],
          },
        ],
      };
    }

    const revenueDelta = Number(comparison.revenueDelta);

    const revenueDeltaPct =
      comparison.revenueDeltaPct === null
        ? null
        : Number(comparison.revenueDeltaPct);

    const transactionDelta = Number(comparison.transactionDelta);

    const transactionDeltaPct =
      comparison.transactionDeltaPct === null
        ? null
        : Number(comparison.transactionDeltaPct);

    title =
      'Comparación de Métodos de Pago: Tarjeta de Crédito vs Boleto Bancario';

    description =
      `Los pagos con tarjeta de crédito generaron R$ ${Number(credit.totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} en ${credit.transactionCount} transacciones, ` +
      `mientras que boleto bancario generó R$ ${Number(boleto.totalValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} en ${boleto.transactionCount} transacciones. ` +
      `La diferencia es de R$ ${revenueDelta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} más en ingresos (${revenueDeltaPct !== null ? `${revenueDeltaPct}%` : 'N/A'}) ` +
      `y ${transactionDelta} transacciones adicionales (${transactionDeltaPct !== null ? `${transactionDeltaPct}%` : 'N/A'}) para tarjeta de crédito.`;

    // Raw per-method claims
    numericClaims.push({
      claimId: 'claim-credit-card-revenue',
      metricKey: 'sales.payment.credit_card.total_value',
      value: Number(credit.totalValue),
      unit: 'BRL',
      evidenceId: paymentEvidence.id,
      sourcePath:
        "$.data.paymentMethods[?(@.paymentType=='credit_card')].totalValue",
      tolerance: 0.01,
    });

    numericClaims.push({
      claimId: 'claim-credit-card-transactions',
      metricKey: 'sales.payment.credit_card.transaction_count',
      value: Number(credit.transactionCount),
      unit: 'COUNT',
      evidenceId: paymentEvidence.id,
      sourcePath:
        "$.data.paymentMethods[?(@.paymentType=='credit_card')].transactionCount",
      tolerance: 0,
    });

    numericClaims.push({
      claimId: 'claim-boleto-revenue',
      metricKey: 'sales.payment.boleto.total_value',
      value: Number(boleto.totalValue),
      unit: 'BRL',
      evidenceId: paymentEvidence.id,
      sourcePath:
        "$.data.paymentMethods[?(@.paymentType=='boleto')].totalValue",
      tolerance: 0.01,
    });

    numericClaims.push({
      claimId: 'claim-boleto-transactions',
      metricKey: 'sales.payment.boleto.transaction_count',
      value: Number(boleto.transactionCount),
      unit: 'COUNT',
      evidenceId: paymentEvidence.id,
      sourcePath:
        "$.data.paymentMethods[?(@.paymentType=='boleto')].transactionCount",
      tolerance: 0,
    });

    // Derived delta claims
    numericClaims.push({
      claimId: 'claim-payment-revenue-delta',
      metricKey: 'sales.payment.comparison.revenue_delta',
      value: revenueDelta,
      unit: 'BRL',
      evidenceId: paymentEvidence.id,
      sourcePath: '$.data.comparison.revenueDelta',
      tolerance: 0.01,
    });

    numericClaims.push({
      claimId: 'claim-payment-transaction-delta',
      metricKey: 'sales.payment.comparison.transaction_delta',
      value: transactionDelta,
      unit: 'COUNT',
      evidenceId: paymentEvidence.id,
      sourcePath: '$.data.comparison.transactionDelta',
      tolerance: 0,
    });

    if (revenueDeltaPct !== null) {
      numericClaims.push({
        claimId: 'claim-payment-revenue-delta-pct',
        metricKey: 'sales.payment.comparison.revenue_delta_pct',
        value: revenueDeltaPct,
        unit: 'PERCENT',
        evidenceId: paymentEvidence.id,
        sourcePath: '$.data.comparison.revenueDeltaPct',
        tolerance: 0.01,
      });
    }

    if (transactionDeltaPct !== null) {
      numericClaims.push({
        claimId: 'claim-payment-transaction-delta-pct',
        metricKey: 'sales.payment.comparison.transaction_delta_pct',
        value: transactionDeltaPct,
        unit: 'PERCENT',
        evidenceId: paymentEvidence.id,
        sourcePath: '$.data.comparison.transactionDeltaPct',
        tolerance: 0.01,
      });
    }

    coverageItems.push({
      component: 'PAYMENT_METHOD_COMPARISON',
      status: payData.length > 0 ? 'ANSWERED' : 'NO_DATA_WITH_REASON',
      evidenceIds: [paymentEvidence.id],
    });
  }

  const finding: Finding = {
    id: `finding-sales-${Date.now()}`,
    investigationId,
    localAgentRunId,
    agent: 'SALES',
    agentName: 'SALES',
    title,
    description,
    findingType: 'SALES_ANALYSIS',
    evidenceIds,
    numericClaims,
    methodClaims,
    auditStatus: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  return { finding, coverageItems };
}
