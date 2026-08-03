import { auditCrossEvidenceConsistency } from './cross-evidence-consistency';
import { Finding, Evidence } from '@commerce-ops/shared-types';

describe('Cross Evidence Consistency Audit', () => {
  it('detects scope hash mismatch across linked evidence items', () => {
    const ev1: Evidence = {
      id: 'e1',
      toolName: 'get_delivery_summary',
      scopeHash: 'hash-A',
      parameters: {},
      resultSummary: 'ok',
      generatedAt: new Date().toISOString(),
    };
    const ev2: Evidence = {
      id: 'e2',
      toolName: 'get_delivery_performance_by_route',
      scopeHash: 'hash-B',
      parameters: {},
      resultSummary: 'ok',
      generatedAt: new Date().toISOString(),
    };

    const finding: Finding = {
      id: 'f1',
      investigationId: 'inv-1',
      agent: 'LOGISTICS',
      title: 'Hallazgo mixto',
      description: 'Combinación',
      findingType: 'LOGISTICS_DELAY',
      evidenceIds: ['e1', 'e2'],
      createdAt: new Date().toISOString(),
    };

    const violations = auditCrossEvidenceConsistency([finding], [ev1, ev2]);
    expect(violations.some((v) => v.code === 'SCOPE_HASH_MISMATCH')).toBe(true);
  });
});
