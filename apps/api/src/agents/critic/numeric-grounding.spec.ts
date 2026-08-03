import { auditNumericClaims } from './numeric-grounding';
import { Finding, Evidence } from '@commerce-ops/shared-types';

describe('Numeric Grounding Audit', () => {
  it('test_critic_rejects_numeric_value_mismatch', () => {
    const findings: Finding[] = [
      {
        id: 'f1',
        investigationId: 'inv1',
        agent: 'SALES',
        title: 'Mishandled total GMV',
        description: 'GMV de 150000.',
        findingType: 'SALES_DROP',
        confidence: 0.9,
        evidenceIds: ['e1'],
        numericClaims: [
          {
            claimId: 'c1',
            metricKey: 'total_gmv',
            value: 150000.0,
            unit: 'BRL',
            evidenceId: 'e1',
            sourcePath: '$.total_gmv',
            tolerance: 0.05,
          },
        ],
        createdAt: new Date().toISOString(),
      },
    ];

    const evidence: Evidence[] = [
      {
        id: 'e1',
        toolName: 'query_sales',
        parameters: {},
        resultSummary: 'Sales summary',
        metrics: [
          {
            key: 'total_gmv',
            label: 'Total GMV',
            value: 100000.0, // Value mismatch: 150000 vs 100000
            unit: 'BRL',
            sourcePath: '$.total_gmv',
          },
        ],
        generatedAt: new Date().toISOString(),
      },
    ];

    const violations = auditNumericClaims(findings, evidence);
    expect(violations.some((v) => v.code === 'NUMERIC_VALUE_MISMATCH')).toBe(
      true,
    );
  });

  it('test_critic_rejects_missing_evidence_metric', () => {
    const findings: Finding[] = [
      {
        id: 'f1',
        investigationId: 'inv1',
        agent: 'LOGISTICS',
        title: 'Late delivery rate',
        description: 'Tasa de 12.5%.',
        findingType: 'LOGISTICS_DELAY',
        confidence: 0.8,
        evidenceIds: ['e1'],
        numericClaims: [
          {
            claimId: 'c2',
            metricKey: 'late_rate_pct',
            value: 12.5,
            unit: 'PERCENT',
            evidenceId: 'e1',
            sourcePath: '$.late_rate_pct',
            tolerance: 0.05,
          },
        ],
        createdAt: new Date().toISOString(),
      },
    ];

    const evidence: Evidence[] = [
      {
        id: 'e1',
        toolName: 'query_logistics',
        parameters: {},
        resultSummary: 'Logistics summary',
        metrics: [
          {
            key: 'average_shipping_days',
            label: 'Días promedio',
            value: 5.0,
            unit: 'DAYS',
            sourcePath: '$.average_shipping_days',
          },
        ],
        generatedAt: new Date().toISOString(),
      },
    ];

    const violations = auditNumericClaims(findings, evidence);
    expect(violations.some((v) => v.code === 'MISSING_EVIDENCE_METRIC')).toBe(
      true,
    );
  });
});
