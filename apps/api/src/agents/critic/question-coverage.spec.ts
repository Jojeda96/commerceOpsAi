import { auditQuestionCoverage } from './question-coverage';

describe('PR-04: Question Coverage Audit', () => {
  it('should detect critical violations when required agent or tools are missing', () => {
    const auditResult = auditQuestionCoverage({
      userQuestion:
        '¿Cuáles son las quejas principales en las reseñas de clientes sobre demoras en la entrega y paquetes dañados?',
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

  it('should pass when all required agents, tools, and components are present', () => {
    const auditResult = auditQuestionCoverage({
      userQuestion:
        '¿Cuáles son las quejas principales en las reseñas de clientes sobre demoras en la entrega y paquetes dañados?',
      requiredCapabilities: ['REVIEW_COMPLAINT_ANALYSIS'],
      requiredAnswerComponents: [
        'REVIEW_COMPLAINT_THEMES',
        'DELIVERY_DELAY_COMPLAINTS',
        'PACKAGE_DAMAGE_COMPLAINTS',
      ],
      selectedAgents: ['CUSTOMER_EXPERIENCE'],
      findings: [
        {
          findingId: 'f-cx',
          agent: 'CUSTOMER_EXPERIENCE',
          findingType: 'REVIEW_COMPLAINT_ANALYSIS',
          title: 'Quejas principales en reseñas de clientes',
          description: 'Demoras y daños analizados',
          auditStatus: 'PENDING',
          evidenceIds: ['ev-cx-1'],
        } as any,
      ],
      evidence: [
        {
          id: 'ev-cx-1',
          toolName: 'analyze_review_complaints',
          agentName: 'CUSTOMER_EXPERIENCE',
          metrics: {
            'reviews.comments.total': 100,
            'reviews.topic.delivery_delay.count': 20,
            'reviews.topic.package_damage.count': 10,
          },
        } as any,
      ],
      answerCoverage: [
        {
          component: 'REVIEW_COMPLAINT_THEMES',
          status: 'ANSWERED',
          evidenceIds: ['ev-cx-1'],
        },
        {
          component: 'DELIVERY_DELAY_COMPLAINTS',
          status: 'ANSWERED',
          evidenceIds: ['ev-cx-1'],
        },
        {
          component: 'PACKAGE_DAMAGE_COMPLAINTS',
          status: 'ANSWERED',
          evidenceIds: ['ev-cx-1'],
        },
      ],
    });

    expect(auditResult.passed).toBe(true);
    expect(auditResult.violations).toHaveLength(0);
  });
});
