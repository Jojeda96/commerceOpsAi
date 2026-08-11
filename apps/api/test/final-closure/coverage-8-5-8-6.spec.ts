import { auditQuestionCoverage } from '../../src/agents/critic/question-coverage';

describe('Test 8.5 � Logistics coverage HISTORICAL_LOGISTICS_CONTEXT = ANSWERED', () => {
  it('should mark HISTORICAL_LOGISTICS_CONTEXT as covered when logistics found and evidence is available', () => {
    const result = auditQuestionCoverage({
      userQuestion: 'Analiza las demoras hist�ricas de entrega',
      requiredCapabilities: [],
      requiredAnswerComponents: ['HISTORICAL_LOGISTICS_CONTEXT'],
      selectedAgents: ['LOGISTICS'],
      findings: [
        {
          id: 'f-log-1',
          investigationId: 'inv-1',
          localAgentRunId: 'run-1',
          agent: 'LOGISTICS',
          title: 'Tasa de atraso log�stico',
          description: 'Tasa de atraso del 8.1%',
          findingType: 'LOGISTICS_DELAY',
          auditStatus: 'PENDING',
          evidenceIds: ['ev-log-1'],
          createdAt: new Date().toISOString(),
        } as any,
      ],
      evidence: [
        {
          id: 'ev-log-1',
          toolName: 'get_delivery_summary',
          agentName: 'LOGISTICS',
          status: 'AVAILABLE',
          sampleSize: 100000,
          resultSummary: '{}',
          generatedAt: new Date().toISOString(),
        } as any,
      ],
      answerCoverage: [
        {
          component: 'HISTORICAL_LOGISTICS_CONTEXT',
          status: 'ANSWERED',
          evidenceIds: ['ev-log-1'],
        },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});

describe('Test 8.6 � Anomaly coverage ANOMALY_DETECTION = ANSWERED', () => {
  it('should mark ANOMALY_DETECTION as covered when anomaly finding exists', () => {
    const result = auditQuestionCoverage({
      userQuestion: 'Detecta anomal�as mediante Z-Score',
      requiredCapabilities: [],
      requiredAnswerComponents: ['ANOMALY_DETECTION'],
      selectedAgents: ['ANOMALY'],
      findings: [
        {
          id: 'f-anom-1',
          investigationId: 'inv-1',
          localAgentRunId: 'run-1',
          agent: 'ANOMALY',
          title: 'Anomal�as detectadas',
          description: 'Z-Score >= 2',
          findingType: 'ANOMALY_DETECTION',
          auditStatus: 'PENDING',
          evidenceIds: ['ev-anom-1'],
          createdAt: new Date().toISOString(),
        } as any,
      ],
      evidence: [
        {
          id: 'ev-anom-1',
          toolName: 'detect_metric_anomalies',
          agentName: 'ANOMALY',
          status: 'AVAILABLE',
          sampleSize: 50000,
          resultSummary: '{}',
          generatedAt: new Date().toISOString(),
        } as any,
      ],
      answerCoverage: [
        {
          component: 'ANOMALY_DETECTION',
          status: 'ANSWERED',
          evidenceIds: ['ev-anom-1'],
        },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});
