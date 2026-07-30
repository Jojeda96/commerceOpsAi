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
        description: 'GMV reported',
        findingType: 'SALES_DROP',
        confidence: 0.9,
        evidenceIds: ['e1'],
        numericClaims: [
          {
            metricKey: 'total_gmv',
            value: 150000.0,
            evidenceId: 'e1',
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
            value: 100000.0, // Value mismatch: 150000 vs 100000
          },
        ],
        generatedAt: new Date().toISOString(),
      },
    ];

    const violations = auditNumericClaims(findings, evidence);
    expect(violations).toHaveLength(1);
    expect(violations[0].code).toBe('NUMERIC_VALUE_MISMATCH');
  });

  it('test_critic_rejects_missing_evidence_metric', () => {
    const findings: Finding[] = [
      {
        id: 'f1',
        investigationId: 'inv1',
        agent: 'LOGISTICS',
        title: 'Late delivery rate',
        description: 'Late rate reported',
        findingType: 'LOGISTICS_DELAY',
        confidence: 0.8,
        evidenceIds: ['e1'],
        numericClaims: [
          {
            metricKey: 'late_rate_pct',
            value: 12.5,
            evidenceId: 'e1',
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
            value: 5.0,
          },
        ],
        generatedAt: new Date().toISOString(),
      },
    ];

    const violations = auditNumericClaims(findings, evidence);
    expect(violations).toHaveLength(1);
    expect(violations[0].code).toBe('MISSING_EVIDENCE_METRIC');
  });
});
