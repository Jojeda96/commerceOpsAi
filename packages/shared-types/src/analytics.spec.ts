import { EvidenceMetric, METRIC_LABELS } from './analytics';

describe('Analytics Contracts', () => {
  it('validates correct EvidenceMetric structure and units', () => {
    const validMetric: EvidenceMetric = {
      key: 'delivery.aggregate.late_rate_pct',
      label: METRIC_LABELS['delivery.aggregate.late_rate_pct'],
      value: 9.3,
      unit: 'PERCENT',
      sampleSize: 61779,
      sourcePath: '$.data.aggregateLateRatePct',
      aggregation: 'WEIGHTED_RATE',
    };

    expect(validMetric.value).toBe(9.3);
    expect(validMetric.unit).toBe('PERCENT');
  });

  it('provides descriptive labels for canonical metric keys', () => {
    expect(METRIC_LABELS['delivery.aggregate.late_rate_pct']).toBe('Tasa histórica agregada de atraso');
    expect(METRIC_LABELS['delivery.routes.unweighted_mean_late_rate_pct']).toBe('Promedio simple de las tasas por ruta');
  });
});
