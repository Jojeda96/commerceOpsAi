import { buildAnomalyFinding } from '../../src/agents/anomaly/build-anomaly-finding';
import { anomalyToolResultFixture } from '../fixtures/final-closure/anomaly-tool-result.fixture';
import { auditMethodProvenance } from '../../src/agents/critic/method-provenance';
import { auditNumericClaims } from '../../src/agents/critic/numeric-grounding';

describe('Closure Query A — Anomaly Investigation (E2E Contract)', () => {
  it('should generate an approved anomaly finding from tool evidence with exact claims and no LLM drift', () => {
    const evidenceItem: any = {
      id: 'ev-anomaly-e2e-1',
      toolName: 'detect_metric_anomalies',
      status: anomalyToolResultFixture.status,
      scopeHash: anomalyToolResultFixture.scopeHash,
      appliedScope: anomalyToolResultFixture.appliedScope,
      rowCount: anomalyToolResultFixture.rowCount,
      sampleSize: anomalyToolResultFixture.sampleSize,
      metrics: anomalyToolResultFixture.metrics,
      resultSummary: JSON.stringify(anomalyToolResultFixture),
      generatedAt: new Date().toISOString(),
    };

    const finding = buildAnomalyFinding({
      investigationId: 'inv-anomaly-e2e',
      localAgentRunId: 'run-1',
      evidence: evidenceItem,
    });

    expect(finding.agent).toBe('ANOMALY');
    expect(finding.findingType).toBe('ANOMALY_DETECTION');
    expect(finding.operationalStatus).toBe('ACTIONABLE');
    expect(finding.auditStatus).toBe('PENDING');

    // Method provenance audit
    const methodViolations = auditMethodProvenance([finding], [evidenceItem]);
    expect(methodViolations).toEqual([]);

    // Numeric grounding audit
    const groundingViolations = auditNumericClaims([finding], [evidenceItem]);
    expect(groundingViolations).toEqual([]);

    // Confirm presence of key numbers in description
    expect(finding.description).toContain('3.46');
    expect(finding.description).toContain('5.24');
    expect(finding.numericClaims!.length).toBeGreaterThanOrEqual(10);
  });
});
