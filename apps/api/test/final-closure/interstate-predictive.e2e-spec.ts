import { buildGovernanceFinding } from '../../src/agents/data-science/build-governance-finding';
import { dsSnapshotEmptyFixture } from '../fixtures/final-closure/ds-snapshot-empty.fixture';
import { auditMethodProvenance } from '../../src/agents/critic/method-provenance';
import { auditNumericClaims } from '../../src/agents/critic/numeric-grounding';
import { evaluatePartialResultPolicy } from '../../src/agents/critic/partial-result-policy';
import { buildUnavailablePredictionCoverage } from '../../src/agents/data-science/build-unavailable-prediction-coverage';

describe('Closure Query B — Interstate Predictive with Empty Snapshots (E2E Contract)', () => {
  it('should produce COMPLETED_WITH_WARNINGS for governance-only answer without erroring on SHAP negation', () => {
    const govEv: any = {
      id: 'ev-ds-gov-1',
      toolName: 'get_delivery_model_governance',
      status: 'AVAILABLE',
      resultSummary: JSON.stringify(dsSnapshotEmptyFixture.governance),
      generatedAt: new Date().toISOString(),
    };

    const scenEv: any = {
      id: 'ev-ds-scen-1',
      toolName: 'get_delivery_prediction_scenarios',
      status: 'UNAVAILABLE',
      reasonCode: 'SNAPSHOT_TABLE_EMPTY',
      resultSummary: JSON.stringify(dsSnapshotEmptyFixture.scenarios),
      generatedAt: new Date().toISOString(),
    };

    const finding = buildGovernanceFinding({
      investigationId: 'inv-interstate-e2e',
      localAgentRunId: 'run-ds-1',
      governance: dsSnapshotEmptyFixture.governance.data,
      unavailabilityReason: 'SNAPSHOT_TABLE_EMPTY',
      evidence: [govEv, scenEv],
    });

    expect(finding.agent).toBe('DATA_SCIENCE');
    expect(finding.findingType).toBe('MODEL_GOVERNANCE');
    expect(finding.operationalStatus).toBe('EXPERIMENTAL_CONTEXT');
    expect(finding.auditStatus).toBe('APPROVED_WITH_WARNINGS');

    // 1. Audit method provenance - should NOT trigger UNSUPPORTED_METHOD_CLAIM for SHAP
    const methodViolations = auditMethodProvenance([finding], [govEv, scenEv]);
    expect(methodViolations).toEqual([]);

    // 2. Audit numeric grounding - should NOT trigger UNDECLARED_RENDERED_NUMBER for version 'v2.0.0'
    const groundingViolations = auditNumericClaims([finding], [govEv, scenEv]);
    expect(groundingViolations).toEqual([]);

    // 3. Evaluate partial result policy
    const coverage = buildUnavailablePredictionCoverage(
      'ev-ds-gov-1',
      'ev-ds-scen-1',
      'SNAPSHOT_TABLE_EMPTY',
    );
    const scopeAudit: any = { isConsistent: true };
    const partialEvaluation = evaluatePartialResultPolicy(scopeAudit, coverage);

    expect(partialEvaluation.decision).toBe('APPROVED_WITH_WARNINGS');
    expect(partialEvaluation.warnings.length).toBeGreaterThan(0);
  });
});
