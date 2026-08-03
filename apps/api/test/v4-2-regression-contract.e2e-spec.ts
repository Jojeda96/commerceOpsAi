import {
  INTERSTATE_PREDICTIVE_QUESTION,
  INTERSTATE_PREDICTIVE_EXPECTED_AGENTS,
  round1,
} from './fixtures/v4-2/interstate-predictive-question.fixture';
import {
  ANOMALY_QUESTION,
  ANOMALY_EXPECTED_AGENTS,
  containsProhibitedPhrase,
} from './fixtures/v4-2/anomaly-zscore-question.fixture';
import { LOGISTICS_INTERSTATE_EVIDENCE_FIXTURE } from './fixtures/v4-2/logistics-interstate-evidence.fixture';
import { ANOMALY_SERIES_EVIDENCE_FIXTURE } from './fixtures/v4-2/anomaly-series-evidence.fixture';

describe('V4.2 Regression Contract Fixtures', () => {
  describe('Fixture 1 — Interstate Predictive Question Invariants', () => {
    it('calculates the exact aggregate interstate late rate correctly', () => {
      const delivered =
        LOGISTICS_INTERSTATE_EVIDENCE_FIXTURE.summary.deliveredOrders;
      const late = LOGISTICS_INTERSTATE_EVIDENCE_FIXTURE.summary.lateOrders;
      const rate = round1((late / delivered) * 100);

      expect(rate).toBe(9.3);
      expect(
        LOGISTICS_INTERSTATE_EVIDENCE_FIXTURE.summary.aggregateLateRatePct,
      ).toBe(9.3);
    });

    it('distinguishes weighted aggregate rate from unweighted mean route rate', () => {
      const { weightedRouteLateRatePct, unweightedMeanRouteLateRatePct } =
        LOGISTICS_INTERSTATE_EVIDENCE_FIXTURE.routesDistribution;

      expect(weightedRouteLateRatePct).toBe(9.3);
      expect(unweightedMeanRouteLateRatePct).toBe(26.3);
      expect(weightedRouteLateRatePct).not.toBe(unweightedMeanRouteLateRatePct);
    });

    it('defines the correct expected agents for interstate question', () => {
      expect(INTERSTATE_PREDICTIVE_QUESTION).toBeDefined();
      expect(INTERSTATE_PREDICTIVE_EXPECTED_AGENTS).toEqual([
        'LOGISTICS',
        'DATA_SCIENCE',
      ]);
    });
  });

  describe('Fixture 2 — Anomaly Question Invariants', () => {
    it('defines the correct expected agents for anomaly question', () => {
      expect(ANOMALY_QUESTION).toBeDefined();
      expect(ANOMALY_EXPECTED_AGENTS).toEqual(['LOGISTICS', 'ANOMALY']);
      expect(ANOMALY_EXPECTED_AGENTS).not.toContain('DATA_SCIENCE');
    });

    it('flags prohibited Z-Score claims in Logistics text', () => {
      const badLogisticsText =
        'El análisis de logística identificó retrasos utilizando el z-score en dos meses.';
      expect(containsProhibitedPhrase(badLogisticsText)).toBe(true);

      const cleanLogisticsText =
        'En el periodo completo se analizaron 61,779 entregas con 9.3% de atraso histórico.';
      expect(containsProhibitedPhrase(cleanLogisticsText)).toBe(false);
    });

    it('verifies structure of anomaly series evidence', () => {
      expect(ANOMALY_SERIES_EVIDENCE_FIXTURE.method).toBe('ROBUST_Z_SCORE');
      expect(ANOMALY_SERIES_EVIDENCE_FIXTURE.anomalies.length).toBe(2);
      expect(ANOMALY_SERIES_EVIDENCE_FIXTURE.anomalies[0].robustZScore).toBe(
        3.46,
      );
    });
  });
});
