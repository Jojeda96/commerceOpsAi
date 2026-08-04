import { classifyCapabilities } from '../supervisor/capability-classifier';
import { mapCapabilitiesToAgents } from '../supervisor/capability-agent-map';
import { classifyAnswerComponents } from '../supervisor/answer-component-classifier';
import { validateRecommendationSupport } from '../strategy/recommendation-support-policy';

describe('PR-08: Three-Query Acceptance Matrix Contract', () => {
  describe('Query A: Review Complaints', () => {
    const questionA =
      '¿Cuáles son las quejas principales en las reseñas de clientes sobre demoras en la entrega y paquetes dañados?';

    it('routes exclusively to CUSTOMER_EXPERIENCE agent', () => {
      const caps = classifyCapabilities(questionA);
      expect(caps).toContain('REVIEW_COMPLAINT_ANALYSIS');

      const agents = mapCapabilitiesToAgents(caps);
      expect(agents).toEqual(['CUSTOMER_EXPERIENCE']);
      expect(agents).not.toContain('LOGISTICS');
    });

    it('classifies required answer components for review complaints', () => {
      const components = classifyAnswerComponents(questionA);
      expect(components).toEqual(
        expect.arrayContaining([
          'REVIEW_COMPLAINT_THEMES',
          'DELIVERY_DELAY_COMPLAINTS',
          'PACKAGE_DAMAGE_COMPLAINTS',
        ]),
      );
    });
  });

  describe('Query B: Anomaly Detection', () => {
    const questionB =
      'Detecta desviaciones o picos anómalos en la tasa de retraso de entregas mediante Z-Score robusto.';

    it('routes to LOGISTICS and ANOMALY agents', () => {
      const caps = classifyCapabilities(questionB);
      expect(caps).toContain('ANOMALY_DETECTION');

      const agents = mapCapabilitiesToAgents(caps);
      expect(agents).toContain('LOGISTICS');
      expect(agents).toContain('ANOMALY');
    });

    it('forces root-cause recommendations to be HYPOTHESIS_TO_TEST', () => {
      const rec = {
        recommendationId: 'rec-anomaly-1',
        kind: 'EVIDENCE_BACKED_ACTION' as const,
        title: 'Investigar causa de picos de retraso',
        description: 'Analizar factores causales de anomalías',
        evidenceBasis: [{ evidenceId: 'ev-zscore' }],
      };

      const validated = validateRecommendationSupport({
        recommendations: [rec],
        findings: [
          {
            findingId: 'f-anomaly',
            agentName: 'ANOMALY',
            findingType: 'ANOMALY_DETECTION',
          } as any,
        ],
        answeredComponents: ['ANOMALY_DETECTION'],
        unavailableComponents: [],
      });

      const resultRec = validated.acceptedRecommendations.find(
        (r) => r.recommendationId === 'rec-anomaly-1',
      );
      expect(resultRec?.kind).toBe('HYPOTHESIS_TO_TEST');
    });
  });

  describe('Query C: Interstate Predictive ML', () => {
    const questionC =
      '¿Cuál es la probabilidad predictiva de atraso en envíos interestatales, el estado de gobernanza del modelo y los factores SHAP de mayor impacto?';

    it('routes to LOGISTICS and DATA_SCIENCE agents', () => {
      const caps = classifyCapabilities(questionC);
      expect(caps).toContain('ML_PREDICTION');

      const agents = mapCapabilitiesToAgents(caps);
      expect(agents).toContain('LOGISTICS');
      expect(agents).toContain('DATA_SCIENCE');
    });

    it('drops SHAP recommendations when LOCAL_EXPLANATION is unavailable', () => {
      const rec = {
        recommendationId: 'rec-shap-1',
        kind: 'EVIDENCE_BACKED_ACTION' as const,
        title: 'Analizar factores SHAP para optimización',
        description: 'Revisar explicaciones locales',
        evidenceBasis: [{ evidenceId: 'ev-ds-gov' }],
      };

      const validated = validateRecommendationSupport({
        recommendations: [rec],
        findings: [],
        answeredComponents: ['MODEL_GOVERNANCE'],
        unavailableComponents: ['LOCAL_EXPLANATION'],
      });

      expect(validated.rejectedOrDropped).toContainEqual(
        expect.objectContaining({
          recommendationId: 'rec-shap-1',
          reason: expect.stringMatching(
            /RECOMMENDATION_REQUIRES_UNAVAILABLE_COMPONENT/,
          ),
        }),
      );
    });
  });
});
