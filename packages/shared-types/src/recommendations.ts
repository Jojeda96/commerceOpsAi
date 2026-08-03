export type RecommendationKind =
  | 'EVIDENCE_BACKED_ACTION'
  | 'HYPOTHESIS_TO_TEST'
  | 'MONITORING_ACTION'
  | 'DATA_QUALITY_ACTION';

export interface ValidatedRecommendation {
  id?: string;
  title: string;
  description: string;
  kind: RecommendationKind;
  actionType: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidenceBasis: string[];
  validationRequirements: string[];
  expectedImpactClaims?: Array<{
    metricKey: string;
    impactDescription: string;
    isProvisionalHypothesis: boolean;
  }>;
}
