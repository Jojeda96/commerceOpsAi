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

  it('does not claim profitability from revenue-only sales findings', () => {
    const rec: Recommendation = {
      id: 'rec-sales',
      investigationId: 'inv-1',
      title: 'Monitoreo de la categoría más rentable',
      description: 'beleza_saude ha demostrado ser la más rentable.',
      priority: 'HIGH',
      kind: 'MONITORING_ACTION',
      supportingFindingIds: ['finding-sales'],
      assumptions: [],
    };

    const result = validateRecommendation(
      rec,
      [
        {
          id: 'finding-sales',
          investigationId: 'inv-1',
          agent: 'SALES',
          title: 'Top Categorías',
          description: '',
          findingType: 'SALES_ANALYSIS',
          evidenceIds: [],
          numericClaims: [
            {
              claimId: 'claim-revenue',
              metricKey: 'sales.category.beleza_saude.revenue',
              value: 1380681.34,
              unit: 'BRL',
              evidenceId: 'ev-sales',
              sourcePath: '$.data.revenue',
            },
          ],
          createdAt: new Date().toISOString(),
        } as any,
      ],
      [],
    );

    expect(result.recommendation.description).not.toMatch(/rentabl/i);
    expect(result.recommendation.description).toMatch(/ingresos/i);
  });
});
