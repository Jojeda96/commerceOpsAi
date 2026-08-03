import { validateRecommendation } from './recommendation-validator';
import { Recommendation } from '@commerce-ops/shared-types';

describe('Recommendation Validator', () => {
  it('rewrites real-time claim to periodic monitoring', () => {
    const rec: Recommendation = {
      id: 'rec-1',
      investigationId: 'inv-1',
      title: 'Detección en tiempo real de atrasos',
      description: 'Implementar alertas en tiempo real para evitar retrasos.',
      priority: 'HIGH',
      supportingFindingIds: [],
      assumptions: [],
    };

    const res = validateRecommendation(rec, [], []);
    expect(res.isModified).toBe(true);
    expect(res.recommendation.kind).toBe('MONITORING_ACTION');
    expect(res.recommendation.title).toContain('monitoreo periódico');
  });

  it('classifies alternative carriers as hypothesis with external data requirement', () => {
    const rec: Recommendation = {
      id: 'rec-2',
      investigationId: 'inv-1',
      title: 'Evaluar transportistas alternativos',
      description: 'Contratar otros fletes para reducir tasa de atraso.',
      priority: 'MEDIUM',
      supportingFindingIds: [],
      assumptions: [],
    };

    const res = validateRecommendation(rec, [], []);
    expect(res.recommendation.kind).toBe('HYPOTHESIS_TO_TEST');
    expect(res.recommendation.validationRequirements?.length).toBeGreaterThan(
      0,
    );
  });
});
