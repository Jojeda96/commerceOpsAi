import { buildGovernanceFinding } from '../../src/agents/data-science/build-governance-finding';

describe('Data Science Partial Governance & Unavailability (PR-00 / PR-04)', () => {
  it('should build governance finding deterministically when snapshots table is empty', () => {
    const finding = buildGovernanceFinding({
      investigationId: 'inv-ds-test',
      governance: {
        modelName: 'xgboost',
        modelVersion: 'delivery-risk-v2.0.0',
        deploymentStatus: 'EXPERIMENTAL_NOT_APPROVED',
        operationallyActionable: false,
        reasons: ['MODEL_EXPERIMENTAL_NOT_APPROVED'],
      },
      unavailabilityReason: 'SNAPSHOT_TABLE_EMPTY',
      evidence: {
        id: 'ev-gov-1',
        toolName: 'get_delivery_model_governance',
        resultSummary: '{}',
        parameters: {},
        generatedAt: new Date().toISOString(),
      },
    });

    expect(finding.agent).toBe('DATA_SCIENCE');
    expect(finding.findingType).toBe('MODEL_GOVERNANCE');
    expect(finding.operationalStatus).toBe('EXPERIMENTAL_CONTEXT');
    expect(finding.confidence).toBeUndefined(); // No 0.85 static confidence
    expect(finding.auditStatus).toBe('APPROVED_WITH_WARNINGS');
    expect(finding.description).toContain('delivery-risk-v2.0.0');
    expect(finding.description).toContain(
      'El almacén de snapshots de features está vacío',
    );
    expect(finding.description).toContain(
      'No se ejecutó inferencia y la explicación local no está disponible',
    );
  });
});
