import { validateRecommendationSupport } from './recommendation-support-policy';

describe('PR-05: Recommendation Support Policy', () => {
  it('should drop or reject EVIDENCE_BACKED_ACTION packaging recommendation when package damage evidence is missing', () => {
    const rec = {
      recommendationId: 'rec-01',
      kind: 'EVIDENCE_BACKED_ACTION' as const,
      title: 'Optimizar embalaje',
      description: 'Mejorar cajas para prevenir daños',
      evidenceBasis: [],
      supportingFindingIds: ['f-logistics-delay'],
    };

    const validated = validateRecommendationSupport({
      recommendations: [rec],
      findings: [
        {
          findingId: 'f-logistics-delay',
          agentName: 'LOGISTICS',
          findingType: 'DESCRIPTIVE_LOGISTICS',
          metrics: { 'logistics.delay_rate': 0.08 },
        } as any,
      ],
      answeredComponents: ['HISTORICAL_LOGISTICS_CONTEXT'],
      unavailableComponents: [],
    });

    expect(validated.rejectedOrDropped).toContainEqual(
      expect.objectContaining({
        recommendationId: 'rec-01',
        reason: expect.stringMatching(
          /RECOMMENDATION_MISSING_EVIDENCE_BASIS|RECOMMENDATION_DOMAIN_NOT_SUPPORTED/,
        ),
      }),
    );
  });

  it('should drop SHAP recommendation when LOCAL_EXPLANATION is unavailable', () => {
    const rec = {
      recommendationId: 'rec-02',
      kind: 'EVIDENCE_BACKED_ACTION' as const,
      title: 'Analizar factores SHAP para optimización de rutas',
      description: 'Revisar impacto de flete',
      evidenceBasis: [{ evidenceId: 'ev-ml-gov' }],
      supportingFindingIds: ['f-ds-gov'],
    };

    const validated = validateRecommendationSupport({
      recommendations: [rec],
      findings: [],
      answeredComponents: ['MODEL_GOVERNANCE'],
      unavailableComponents: ['LOCAL_EXPLANATION'],
    });

    expect(validated.rejectedOrDropped).toContainEqual(
      expect.objectContaining({
        recommendationId: 'rec-02',
        reason: expect.stringMatching(
          /RECOMMENDATION_REQUIRES_UNAVAILABLE_COMPONENT/,
        ),
      }),
    );
  });

  it('should reclassify anomaly root-cause investigation from EVIDENCE_BACKED_ACTION to HYPOTHESIS_TO_TEST', () => {
    const rec = {
      recommendationId: 'rec-03',
      kind: 'EVIDENCE_BACKED_ACTION' as const,
      title: 'Investigar causa de picos de retraso',
      description: 'Analizar causas profundas de anomalías en entregas',
      evidenceBasis: [{ evidenceId: 'ev-anomaly-zscore' }],
      supportingFindingIds: ['f-anomaly'],
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

    const outputRec = validated.acceptedRecommendations.find(
      (r) => r.recommendationId === 'rec-03',
    );
    expect(outputRec).toBeDefined();
    expect(outputRec?.kind).toBe('HYPOTHESIS_TO_TEST');
  });
});
