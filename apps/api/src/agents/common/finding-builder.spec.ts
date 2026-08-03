import { buildLogisticsFinding } from '../logistics/build-logistics-finding';
import { buildAnomalyFinding } from '../anomaly/build-anomaly-finding';
import { auditNumericClaims } from '../critic/numeric-grounding';
import { Evidence } from '@commerce-ops/shared-types';

describe('Deterministic Finding Builders and Grounding Audit', () => {
  const aggregateEvidence: Evidence = {
    id: 'ev-agg-1',
    toolName: 'get_delivery_summary',
    scopeHash: 'hash-1',
    parameters: {},
    resultSummary: JSON.stringify({
      status: 'AVAILABLE',
      data: {
        deliveredOrders: 61779,
        lateOrders: 5722,
        aggregateLateRatePct: 9.3,
        averageDeliveryDays: 12.5,
        averageDelayDays: 9.4,
      },
    }),
    metrics: [
      {
        key: 'delivery.aggregate.delivered_orders',
        label: 'Total de pedidos entregados',
        value: 61779,
        unit: 'COUNT',
        sampleSize: 61779,
        sourcePath: '$.data.deliveredOrders',
      },
      {
        key: 'delivery.aggregate.late_orders',
        label: 'Total de pedidos entregados tarde',
        value: 5722,
        unit: 'COUNT',
        sampleSize: 61779,
        sourcePath: '$.data.lateOrders',
      },
      {
        key: 'delivery.aggregate.late_rate_pct',
        label: 'Tasa histórica agregada de atraso',
        value: 9.3,
        unit: 'PERCENT',
        sampleSize: 61779,
        sourcePath: '$.data.aggregateLateRatePct',
      },
    ],
    generatedAt: new Date().toISOString(),
  };

  it('builds a Logistics finding with grounded claims that passes numeric audit', () => {
    const finding = buildLogisticsFinding({
      investigationId: 'inv-1',
      userQuestion: '¿Cuál es la tasa de atrasos interestatales?',
      scope: { interstateOnly: true, provenance: [], scopeHash: 'hash-1' },
      aggregateEvidence,
    });

    expect(finding.numericClaims).toBeDefined();
    expect(finding.numericClaims?.length).toBeGreaterThan(0);

    const violations = auditNumericClaims([finding], [aggregateEvidence]);
    expect(violations.length).toBe(0);
  });

  it('detects derived rate mismatch when late rate claim is falsified to 26.3%', () => {
    const finding = buildLogisticsFinding({
      investigationId: 'inv-1',
      userQuestion: '¿Cuál es la tasa de atrasos interestatales?',
      scope: { interstateOnly: true, provenance: [], scopeHash: 'hash-1' },
      aggregateEvidence,
    });

    // Falsify the rate claim in finding
    const rateClaim = finding.numericClaims?.find(
      (c) => c.metricKey === 'delivery.aggregate.late_rate_pct',
    );
    if (rateClaim) {
      rateClaim.value = 26.3;
    }

    const violations = auditNumericClaims([finding], [aggregateEvidence]);
    expect(
      violations.some(
        (v) =>
          v.code === 'DERIVED_RATE_MISMATCH' ||
          v.code === 'NUMERIC_VALUE_MISMATCH',
      ),
    ).toBe(true);
  });
});
