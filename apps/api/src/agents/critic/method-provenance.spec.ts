import { auditMethodProvenance } from './method-provenance';
import { Finding, Evidence } from '@commerce-ops/shared-types';

describe('Method Provenance Audit', () => {
  it('rejects Logistics finding that claims Z-Score without detect_metric_anomalies evidence', () => {
    const finding: Finding = {
      id: 'f-log',
      investigationId: 'inv-1',
      agent: 'LOGISTICS',
      title: 'Análisis de logística',
      description: 'Se evaluaron entregas utilizando el Z-Score robusto.',
      findingType: 'LOGISTICS_DELAY',
      evidenceIds: ['ev-summary'],
      createdAt: new Date().toISOString(),
    };

    const evidence: Evidence = {
      id: 'ev-summary',
      toolName: 'get_delivery_summary',
      scopeHash: 'hash-1',
      parameters: {},
      resultSummary: 'ok',
      generatedAt: new Date().toISOString(),
    };

    const violations = auditMethodProvenance([finding], [evidence]);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].code).toBe('UNSUPPORTED_METHOD_CLAIM');
  });

  it('passes when Anomaly agent has detect_metric_anomalies evidence for Z-Score', () => {
    const finding: Finding = {
      id: 'f-anom',
      investigationId: 'inv-1',
      agent: 'ANOMALY',
      title: 'Anomalías detectadas',
      description: 'Se evaluó la serie mensual mediante Z-Score robusto.',
      findingType: 'ANOMALY_DETECTION',
      evidenceIds: ['ev-anom'],
      methodClaims: [
        {
          method: 'ROBUST_Z_SCORE',
          evidenceId: 'ev-anom',
          toolName: 'detect_metric_anomalies',
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const evidence: Evidence = {
      id: 'ev-anom',
      toolName: 'detect_metric_anomalies',
      scopeHash: 'hash-1',
      parameters: {},
      resultSummary: 'ok',
      generatedAt: new Date().toISOString(),
    };

    const violations = auditMethodProvenance([finding], [evidence]);
    expect(violations.length).toBe(0);
  });
});
