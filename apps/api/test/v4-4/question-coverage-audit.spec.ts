import { auditQuestionCoverage } from '../../src/agents/critic/question-coverage';

describe('PR-00 / V4.4: Question Coverage Audit Contract', () => {
  it('should detect critical violations when required agent or tools are missing', () => {
    const auditResult = auditQuestionCoverage({
      userQuestion: '¿Cuáles son las quejas principales en las reseñas de clientes sobre demoras en la entrega y paquetes dañados?',
      requiredCapabilities: ['REVIEW_COMPLAINT_ANALYSIS'],
      requiredAnswerComponents: [
        'REVIEW_COMPLAINT_THEMES',
        'DELIVERY_DELAY_COMPLAINTS',
        'PACKAGE_DAMAGE_COMPLAINTS',
      ],
      selectedAgents: ['LOGISTICS'],
      findings: [
        {
          findingId: 'f-logistics',
          agentName: 'LOGISTICS',
          findingType: 'DESCRIPTIVE_LOGISTICS',
          title: 'Tasa logistica',
          description: 'Tasa de atraso global 8.1%',
          auditStatus: 'PENDING',
          evidenceIds: ['ev-1'],
        } as any,
      ],
      evidence: [],
      answerCoverage: [],
    });

    expect(auditResult.passed).toBe(false);
    expect(auditResult.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MISSING_REQUIRED_AGENT',
          details: expect.stringContaining('CUSTOMER_EXPERIENCE'),
        }),
        expect.objectContaining({
          code: 'MISSING_REQUIRED_TOOL',
          details: expect.stringContaining('analyze_review_complaints'),
        }),
        expect.objectContaining({
          code: 'QUESTION_COMPONENT_NOT_ANSWERED',
        }),
      ]),
    );
  });
});
