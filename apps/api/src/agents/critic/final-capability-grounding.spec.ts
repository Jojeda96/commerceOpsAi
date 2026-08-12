import { auditNumericClaims } from './numeric-grounding';

describe('final capability numeric grounding', () => {
  it('accepts category sales claims when evidence metrics match', () => {
    const evidence: any = {
      id: 'ev-sales',
      toolName: 'get_sales_by_category',
      metrics: [
        {
          key: 'sales.category.moveis_decoracao.revenue',
          value: 1000,
          unit: 'BRL',
          sourcePath: "$.data[?(@.category=='moveis_decoracao')].revenue",
        },
      ],
    };

    const finding: any = {
      id: 'finding-sales',
      description: 'Ingresos R$ 1.000,00',
      numericClaims: [
        {
          claimId: 'claim-1',
          metricKey: 'sales.category.moveis_decoracao.revenue',
          value: 1000,
          unit: 'BRL',
          evidenceId: 'ev-sales',
          sourcePath: "$.data[?(@.category=='moveis_decoracao')].revenue",
          tolerance: 0.01,
        },
      ],
    };

    expect(auditNumericClaims([finding], [evidence])).toEqual([]);
  });

  it('accepts payment delta claim when evidence metrics match', () => {
    const evidence: any = {
      id: 'ev-payment',
      toolName: 'get_sales_by_payment_method',
      metrics: [
        {
          key: 'sales.payment.comparison.revenue_delta',
          value: 5000,
          unit: 'BRL',
          sourcePath: '$.data.comparison.revenueDelta',
        },
      ],
    };

    const finding: any = {
      id: 'finding-payment',
      description: 'Diferencia R$ 5.000,00',
      numericClaims: [
        {
          claimId: 'claim-payment-delta',
          metricKey: 'sales.payment.comparison.revenue_delta',
          value: 5000,
          unit: 'BRL',
          evidenceId: 'ev-payment',
          sourcePath: '$.data.comparison.revenueDelta',
          tolerance: 0.01,
        },
      ],
    };

    expect(auditNumericClaims([finding], [evidence])).toEqual([]);
  });

  it('accepts seller revenue claim when evidence metrics match', () => {
    const evidence: any = {
      id: 'ev-seller',
      toolName: 'get_seller_scorecard',
      metrics: [
        {
          key: 'seller.revenue',
          value: 80000,
          unit: 'BRL',
          sourcePath: '$.data.totalRevenue',
        },
      ],
    };

    const finding: any = {
      id: 'finding-seller',
      description: 'Ingresos R$ 80.000,00',
      numericClaims: [
        {
          claimId: 'claim-seller-revenue',
          metricKey: 'seller.revenue',
          value: 80000,
          unit: 'BRL',
          evidenceId: 'ev-seller',
          sourcePath: '$.data.totalRevenue',
          tolerance: 0.01,
        },
      ],
    };

    expect(auditNumericClaims([finding], [evidence])).toEqual([]);
  });

  it('accepts seller late_rate claim when evidence metrics match', () => {
    const evidence: any = {
      id: 'ev-seller-sc',
      toolName: 'get_seller_scorecard',
      metrics: [
        {
          key: 'seller.late_rate_pct',
          value: 15.5,
          unit: 'PERCENT',
          sourcePath: '$.data.lateRate',
        },
      ],
    };

    const finding: any = {
      id: 'finding-seller-risk',
      description: 'Tasa de atraso: 15.5%',
      numericClaims: [
        {
          claimId: 'claim-seller-late',
          metricKey: 'seller.late_rate_pct',
          value: 15.5,
          unit: 'PERCENT',
          evidenceId: 'ev-seller-sc',
          sourcePath: '$.data.lateRate',
          tolerance: 0.1,
        },
      ],
    };

    expect(auditNumericClaims([finding], [evidence])).toEqual([]);
  });

  it('accepts delivery relative_change_pct when evidence metrics match', () => {
    const evidence: any = {
      id: 'ev-delivery-comp',
      toolName: 'compare_delivery_summary_periods',
      metrics: [
        {
          key: 'delivery.comparison.relative_change_pct',
          value: 25.5,
          unit: 'PERCENT',
          sourcePath: '$.data.relativeChangePct',
        },
      ],
    };

    const finding: any = {
      id: 'finding-logistics',
      description: 'Variación relativa: 25.5%',
      numericClaims: [
        {
          claimId: 'claim-comp-relative-pct',
          metricKey: 'delivery.comparison.relative_change_pct',
          value: 25.5,
          unit: 'PERCENT',
          evidenceId: 'ev-delivery-comp',
          sourcePath: '$.data.relativeChangePct',
          tolerance: 0.1,
        },
      ],
    };

    expect(auditNumericClaims([finding], [evidence])).toEqual([]);
  });

  it('accepts rating relative_change_pct when evidence metrics match', () => {
    const evidence: any = {
      id: 'ev-rating-comp',
      toolName: 'compare_rating_summary_periods',
      metrics: [
        {
          key: 'reviews.comparison.relative_change_pct',
          value: 5,
          unit: 'PERCENT',
          sourcePath: '$.data.relativeChangePct',
        },
      ],
    };

    const finding: any = {
      id: 'finding-cx',
      description: 'Variación relativa: 5%',
      numericClaims: [
        {
          claimId: 'claim-rating-relative',
          metricKey: 'reviews.comparison.relative_change_pct',
          value: 5,
          unit: 'PERCENT',
          evidenceId: 'ev-rating-comp',
          sourcePath: '$.data.relativeChangePct',
          tolerance: 0.01,
        },
      ],
    };

    expect(auditNumericClaims([finding], [evidence])).toEqual([]);
  });
});
