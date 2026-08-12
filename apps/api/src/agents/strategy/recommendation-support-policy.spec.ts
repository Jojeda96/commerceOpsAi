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

  // Test 8.9: Recommendation metric check
  it('Test 8.9 — recommendation for review complaints must reference reviews.topic.delivery_delay.share_pct and not lateRate', () => {
    const rec = {
      recommendationId: 'rec-cx-01',
      kind: 'MONITORING_ACTION' as const,
      title: 'Monitorear quejas de retraso en reseñas',
      description:
        'Monitorear la proporción de reseñas sobre entregas tardías.',
      evidenceBasis: [
        {
          evidenceId: 'ev-cx-1',
          findingId: 'f-cx-1',
          metricKeys: ['reviews.topic.delivery_delay.share_pct'],
          answerComponents: ['DELIVERY_DELAY_COMPLAINTS'],
        },
      ],
      supportingFindingIds: ['f-cx-1'],
    };

    const validated = validateRecommendationSupport({
      recommendations: [rec],
      findings: [
        {
          id: 'f-cx-1',
          agent: 'CUSTOMER_EXPERIENCE',
          findingType: 'REVIEW_COMPLAINT_ANALYSIS',
          title: 'Quejas principales en reseñas de clientes',
          description: 'Demoras en la entrega',
        } as any,
      ],
      answeredComponents: [
        'REVIEW_COMPLAINT_THEMES',
        'DELIVERY_DELAY_COMPLAINTS',
      ],
      unavailableComponents: [],
    });

    const accepted = validated.acceptedRecommendations[0];
    expect(accepted).toBeDefined();
    expect(accepted.evidenceBasis![0].metricKeys).toContain(
      'reviews.topic.delivery_delay.share_pct',
    );
    expect(accepted.evidenceBasis![0].metricKeys).not.toContain('lateRate');
  });

  it('reclassifies packaging action from review evidence as hypothesis', () => {
    const rec = {
      recommendationId: 'rec-packaging',
      kind: 'EVIDENCE_BACKED_ACTION' as const,
      title: 'Fortalecer el embalaje de productos',
      description:
        'Mejorar el embalaje para reducir daños durante el transporte.',
      evidenceBasis: [
        {
          evidenceId: 'ev-cx-damage',
          findingId: 'f-cx-damage',
          metricKeys: ['reviews.topic.package_damage.share_pct'],
          answerComponents: ['PACKAGE_DAMAGE_COMPLAINTS'],
        },
      ],
      supportingFindingIds: ['f-cx-damage'],
    };

    const result = validateRecommendationSupport({
      recommendations: [rec],
      findings: [
        {
          id: 'f-cx-damage',
          agent: 'CUSTOMER_EXPERIENCE',
          findingType: 'REVIEW_COMPLAINT_ANALYSIS',
          title: 'Quejas por productos dañados',
          description: 'Se observaron reseñas relacionadas con daños.',
        } as any,
      ],
      answeredComponents: [
        'REVIEW_COMPLAINT_THEMES',
        'PACKAGE_DAMAGE_COMPLAINTS',
      ],
      unavailableComponents: [],
    });

    const accepted = result.acceptedRecommendations[0];

    expect(accepted.kind).toBe('HYPOTHESIS_TO_TEST');
    expect(accepted.description).toMatch(/no demuestran causalidad/i);
  });
});
