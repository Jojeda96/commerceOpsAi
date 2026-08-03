import { INTERSTATE_PREDICTIVE_QUESTION } from './fixtures/v4-2/interstate-predictive-question.fixture';
import { buildLogisticsFinding } from '../src/agents/logistics/build-logistics-finding';
import { buildAnomalyFinding } from '../src/agents/anomaly/build-anomaly-finding';
import { auditNumericClaims } from '../src/agents/critic/numeric-grounding';
import { auditMethodProvenance } from '../src/agents/critic/method-provenance';
import { Evidence } from '@commerce-ops/shared-types';

describe('V4.2 End-to-End & Integration Quality Gates', () => {
  describe('Interstate Predictive Question Gate', () => {
    it('enforces aggregate 9.3% late rate, separate route mean, and scope hash parity', () => {
      const summaryEvidence: Evidence = {
        id: 'ev-summary-1',
        toolName: 'get_delivery_summary',
        scopeHash: 'hash-interstate-1',
        status: 'AVAILABLE',
        parameters: { interstateOnly: true, scopeHash: 'hash-interstate-1' },
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
            label: 'Total entregados',
            value: 61779,
            unit: 'COUNT',
            sampleSize: 61779,
            sourcePath: '$.data.deliveredOrders',
          },
          {
            key: 'delivery.aggregate.late_orders',
            label: 'Total tardíos',
            value: 5722,
            unit: 'COUNT',
            sampleSize: 61779,
            sourcePath: '$.data.lateOrders',
          },
          {
            key: 'delivery.aggregate.late_rate_pct',
            label: 'Tasa agregada',
            value: 9.3,
            unit: 'PERCENT',
            sampleSize: 61779,
            sourcePath: '$.data.aggregateLateRatePct',
          },
        ],
        generatedAt: new Date().toISOString(),
      };

      const routeEvidence: Evidence = {
        id: 'ev-routes-1',
        toolName: 'get_delivery_performance_by_route',
        scopeHash: 'hash-interstate-1',
        status: 'AVAILABLE',
        parameters: { interstateOnly: true, scopeHash: 'hash-interstate-1' },
        resultSummary: JSON.stringify({
          status: 'AVAILABLE',
          data: {
            eligibleRouteCount: 42,
            weightedRouteLateRatePct: 9.3,
            unweightedMeanRouteLateRatePct: 26.3,
            medianRouteLateRatePct: 18.2,
            routes: [],
          },
        }),
        metrics: [
          {
            key: 'delivery.routes.eligible_route_count',
            label: 'Cantidad rutas',
            value: 42,
            unit: 'COUNT',
            sampleSize: 42,
            sourcePath: '$.data.eligibleRouteCount',
          },
          {
            key: 'delivery.routes.unweighted_mean_late_rate_pct',
            label: 'Promedio simple',
            value: 26.3,
            unit: 'PERCENT',
            sampleSize: 42,
            sourcePath: '$.data.unweightedMeanRouteLateRatePct',
          },
          {
            key: 'delivery.routes.median_late_rate_pct',
            label: 'Mediana',
            value: 18.2,
            unit: 'PERCENT',
            sampleSize: 42,
            sourcePath: '$.data.medianRouteLateRatePct',
          },
        ],
        generatedAt: new Date().toISOString(),
      };

      const finding = buildLogisticsFinding({
        investigationId: 'inv-interstate',
        userQuestion: INTERSTATE_PREDICTIVE_QUESTION,
        scope: {
          interstateOnly: true,
          provenance: [],
          scopeHash: 'hash-interstate-1',
        },
        aggregateEvidence: summaryEvidence,
        routeEvidence,
      });

      expect(finding.description).toContain('9.3%');
      expect(finding.description).toContain('26.3%');
      expect(finding.description).toContain(
        'promedio simple de las tasas por ruta',
      );

      const numericViolations = auditNumericClaims(
        [finding],
        [summaryEvidence, routeEvidence],
      );
      expect(numericViolations.length).toBe(0);

      const methodViolations = auditMethodProvenance(
        [finding],
        [summaryEvidence, routeEvidence],
      );
      expect(methodViolations.length).toBe(0);
    });
  });

  describe('Anomaly Robust Z-Score Gate', () => {
    it('prevents Logistics from claiming Z-Score and verifies Anomaly grounded finding', () => {
      const anomalyEvidence: Evidence = {
        id: 'ev-anom-1',
        toolName: 'detect_metric_anomalies',
        scopeHash: 'hash-anom-1',
        status: 'AVAILABLE',
        parameters: { scopeHash: 'hash-anom-1' },
        resultSummary: JSON.stringify({
          status: 'AVAILABLE',
          data: {
            method: 'ROBUST_Z_SCORE',
            threshold: 3.0,
            monthsEvaluated: 24,
            medianMonthlyLateRatePct: 7.8,
            mad: 1.2,
            anomalies: [
              {
                month: '2018-02',
                lateRatePct: 14.5,
                sampleSize: 3200,
                robustZScore: 3.46,
              },
              {
                month: '2018-03',
                lateRatePct: 18.2,
                sampleSize: 3500,
                robustZScore: 5.24,
              },
            ],
          },
        }),
        metrics: [
          {
            key: 'anomaly.series.months_evaluated',
            label: 'Meses',
            value: 24,
            unit: 'COUNT',
            sourcePath: '$.data.monthsEvaluated',
          },
          {
            key: 'anomaly.series.threshold',
            label: 'Umbral',
            value: 3.0,
            unit: 'ROBUST_Z_SCORE',
            sourcePath: '$.data.threshold',
          },
          {
            key: 'anomaly.series.median_monthly_late_rate_pct',
            label: 'Mediana',
            value: 7.8,
            unit: 'PERCENT',
            sourcePath: '$.data.medianMonthlyLateRatePct',
          },
          {
            key: 'anomaly.series.mad',
            label: 'MAD',
            value: 1.2,
            unit: 'PERCENT',
            sourcePath: '$.data.mad',
          },
          {
            key: 'anomaly.series.anomaly_count',
            label: 'Cantidad de anomalías',
            value: 2,
            unit: 'COUNT',
            sourcePath: '$.data.anomalyCount',
          },
          {
            key: 'anomaly.point.2018-02.late_rate_pct',
            label: 'Tasa 2018-02',
            value: 14.5,
            unit: 'PERCENT',
            sampleSize: 3200,
            sourcePath: '$.data.anomalies[0].lateRatePct',
          },
          {
            key: 'anomaly.point.2018-02.sample_size',
            label: 'Muestra 2018-02',
            value: 3200,
            unit: 'COUNT',
            sampleSize: 3200,
            sourcePath: '$.data.anomalies[0].sampleSize',
          },
          {
            key: 'anomaly.point.2018-02.robust_z_score',
            label: 'Z 2018-02',
            value: 3.46,
            unit: 'ROBUST_Z_SCORE',
            sampleSize: 3200,
            sourcePath: '$.data.anomalies[0].robustZScore',
          },
          {
            key: 'anomaly.point.2018-03.late_rate_pct',
            label: 'Tasa 2018-03',
            value: 18.2,
            unit: 'PERCENT',
            sampleSize: 3500,
            sourcePath: '$.data.anomalies[1].lateRatePct',
          },
          {
            key: 'anomaly.point.2018-03.sample_size',
            label: 'Muestra 2018-03',
            value: 3500,
            unit: 'COUNT',
            sampleSize: 3500,
            sourcePath: '$.data.anomalies[1].sampleSize',
          },
          {
            key: 'anomaly.point.2018-03.robust_z_score',
            label: 'Z 2018-03',
            value: 5.24,
            unit: 'ROBUST_Z_SCORE',
            sampleSize: 3500,
            sourcePath: '$.data.anomalies[1].robustZScore',
          },
        ],
        generatedAt: new Date().toISOString(),
      };

      const anomalyFinding = buildAnomalyFinding({
        investigationId: 'inv-anom',
        evidence: anomalyEvidence,
      });

      expect(anomalyFinding.description).toContain('Robust Z-Score');
      expect(anomalyFinding.description).toContain('2018-02');
      expect(anomalyFinding.description).toContain('3.46');
      expect(anomalyFinding.description).toContain('5.24');

      const violations = auditNumericClaims(
        [anomalyFinding],
        [anomalyEvidence],
      );
      expect(violations.length).toBe(0);
    });
  });
});
