import { auditQuestionCoverage } from './question-coverage';

describe('Test 8.7 � UNAVAILABLE_WITH_REASON does not generate critical error', () => {
  it('should return passed=true when ML component is UNAVAILABLE_WITH_REASON with valid reasonCode', () => {
    const result = auditQuestionCoverage({
      userQuestion: 'Predicci�n de atraso en env�os',
      requiredCapabilities: [],
      requiredAnswerComponents: ['PREDICTION', 'LOCAL_EXPLANATION'],
      selectedAgents: ['DATA_SCIENCE'],
      findings: [
        {
          id: 'f-ds-1',
          investigationId: 'inv-1',
          localAgentRunId: 'run-1',
          agent: 'DATA_SCIENCE',
          title: 'Model Governance',
          description: 'Modelo en experimental',
          findingType: 'MODEL_GOVERNANCE',
          auditStatus: 'PENDING',
          evidenceIds: ['ev-gov-1'],
          operationalStatus: 'EXPERIMENTAL_CONTEXT',
          createdAt: new Date().toISOString(),
        } as any,
      ],
      evidence: [
        {
          id: 'ev-gov-1',
          toolName: 'get_delivery_model_governance',
          agentName: 'DATA_SCIENCE',
          status: 'AVAILABLE',
          resultSummary: '{}',
          generatedAt: new Date().toISOString(),
        } as any,
        {
          id: 'ev-scen-1',
          toolName: 'get_delivery_prediction_scenarios',
          agentName: 'DATA_SCIENCE',
          status: 'UNAVAILABLE',
          reasonCode: 'SNAPSHOT_TABLE_EMPTY',
          resultSummary: '{}',
          generatedAt: new Date().toISOString(),
        } as any,
      ],
      answerCoverage: [
        {
          component: 'PREDICTION',
          status: 'UNAVAILABLE_WITH_REASON',
          reasonCode: 'SNAPSHOT_TABLE_EMPTY',
          evidenceIds: ['ev-scen-1'],
        },
        {
          component: 'LOCAL_EXPLANATION',
          status: 'UNAVAILABLE_WITH_REASON',
          reasonCode: 'NO_VALID_PREDICTION',
          evidenceIds: ['ev-scen-1'],
        },
      ],
    });

    expect(result.passed).toBe(true);
    const criticals = result.violations.filter(
      (v) => v.severity === 'CRITICAL',
    );
    expect(criticals).toHaveLength(0);
  });
});

describe('Test 8.8 � LOCAL_EXPLANATION not required when there is no prediction', () => {
  it('should not generate QUESTION_COMPONENT_NOT_ANSWERED when LOCAL_EXPLANATION is UNAVAILABLE due to no valid prediction', () => {
    const result = auditQuestionCoverage({
      userQuestion: 'Predicci�n de atraso sin escenarios',
      requiredCapabilities: [],
      requiredAnswerComponents: ['LOCAL_EXPLANATION'],
      selectedAgents: ['DATA_SCIENCE'],
      findings: [],
      evidence: [
        {
          id: 'ev-ds-1',
          agentName: 'DATA_SCIENCE',
          toolName: 'get_delivery_prediction_scenarios',
          status: 'UNAVAILABLE',
          reasonCode: 'SNAPSHOT_TABLE_EMPTY',
          resultSummary: '{}',
          generatedAt: new Date().toISOString(),
        } as any,
      ],
      answerCoverage: [
        {
          component: 'LOCAL_EXPLANATION',
          status: 'UNAVAILABLE_WITH_REASON',
          reasonCode: 'NO_VALID_PREDICTION',
          evidenceIds: ['ev-ds-1'],
        },
      ],
    });

    const criticals = result.violations.filter(
      (v) => v.severity === 'CRITICAL',
    );
    expect(criticals).toHaveLength(0);
  });
});
