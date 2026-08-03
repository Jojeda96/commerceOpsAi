import { calculateDeterministicEvidenceQuality } from './evidence-quality';
import { Finding, Evidence } from '@commerce-ops/shared-types';

describe('Deterministic Evidence Quality Rubric', () => {
  it('computes 100-point rubric deterministically for valid findings', () => {
    const evidence: Evidence = {
      id: 'ev-1',
      toolName: 'get_delivery_summary',
      scopeHash: 'hash-123',
      status: 'AVAILABLE',
      parameters: {},
      resultSummary: 'ok',
      sampleSize: 5000,
      metrics: [
        {
          key: 'delivery.aggregate.late_rate_pct',
          label: 'Tasa',
          value: 9.3,
          unit: 'PERCENT',
          sourcePath: '$.lateRatePct',
        },
      ],
      generatedAt: new Date().toISOString(),
    };

    const finding: Finding = {
      id: 'f-1',
      investigationId: 'inv-1',
      agent: 'LOGISTICS',
      title: 'Hallazgo de entregas',
      description: 'La tasa agregada es de 9.3%.',
      findingType: 'LOGISTICS_DELAY',
      evidenceIds: ['ev-1'],
      numericClaims: [
        {
          claimId: 'c-1',
          metricKey: 'delivery.aggregate.late_rate_pct',
          value: 9.3,
          unit: 'PERCENT',
          evidenceId: 'ev-1',
          sourcePath: '$.lateRatePct',
          tolerance: 0.05,
        },
      ],
      methodClaims: [
        {
          method: 'DESCRIPTIVE_AGGREGATION',
          evidenceId: 'ev-1',
          toolName: 'get_delivery_summary',
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const result = calculateDeterministicEvidenceQuality(finding, [evidence]);
    expect(result.score).toBeGreaterThanOrEqual(0.85);
    expect(result.grade).toBe('HIGH');
    expect(result.computedBy).toBe('DETERMINISTIC_V4_2');
  });

  it('returns NOT_APPLICABLE for MODEL_GOVERNANCE finding type', () => {
    const finding: Finding = {
      id: 'f-gov',
      investigationId: 'inv-1',
      agent: 'DATA_SCIENCE',
      title: 'Gobernanza del Modelo',
      description: 'Estado del modelo',
      findingType: 'MODEL_GOVERNANCE',
      evidenceIds: [],
      createdAt: new Date().toISOString(),
    };

    const result = calculateDeterministicEvidenceQuality(finding, []);
    expect(result.grade).toBe('NOT_APPLICABLE');
    expect(result.score).toBe(1.0);
  });
});
