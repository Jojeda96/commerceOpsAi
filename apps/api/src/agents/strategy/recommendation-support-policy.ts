import {
  Finding,
  AnswerComponent,
  RecommendationKind,
} from '@commerce-ops/shared-types';
import {
  classifyRecommendationDomain,
  RecommendationDomain,
} from './recommendation-domain';

export interface RecommendationInputItem {
  recommendationId?: string;
  id?: string;
  kind: RecommendationKind;
  title: string;
  description: string;
  actionType?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidenceBasis?: any[];
  supportingFindingIds?: string[];
  validationRequirements?: string[];
  expectedImpactClaims?: any[];
}

export interface ValidateRecommendationSupportInput {
  recommendations: RecommendationInputItem[];
  findings: Finding[];
  answeredComponents: AnswerComponent[];
  unavailableComponents: AnswerComponent[];
}

export interface RejectedOrDroppedRecommendation {
  recommendationId: string;
  title: string;
  reason: string;
  domain: RecommendationDomain;
}

export interface ValidateRecommendationSupportResult {
  acceptedRecommendations: RecommendationInputItem[];
  rejectedOrDropped: RejectedOrDroppedRecommendation[];
}

export function validateRecommendationSupport(
  input: ValidateRecommendationSupportInput,
): ValidateRecommendationSupportResult {
  const {
    recommendations,
    findings,
    answeredComponents,
    unavailableComponents,
  } = input;

  const acceptedRecommendations: RecommendationInputItem[] = [];
  const rejectedOrDropped: RejectedOrDroppedRecommendation[] = [];

  const hasPackageDamageEvidence =
    answeredComponents.includes('PACKAGE_DAMAGE_COMPLAINTS') ||
    findings.some((f) => {
      const text = `${f.title} ${f.description}`.toLowerCase();
      return (
        text.includes('daño') ||
        text.includes('quebrado') ||
        text.includes('package_damage') ||
        (f as any).findingType === 'REVIEW_COMPLAINT_ANALYSIS'
      );
    });

  for (let idx = 0; idx < recommendations.length; idx++) {
    const rec = { ...recommendations[idx] };
    const recId = rec.recommendationId || rec.id || `rec-${idx + 1}`;
    rec.recommendationId = recId;
    rec.id = recId;

    const domain = classifyRecommendationDomain(rec.title, rec.description);

    // Rule 1: EVIDENCE_BACKED_ACTION requires non-empty evidenceBasis
    if (
      rec.kind === 'EVIDENCE_BACKED_ACTION' &&
      (!rec.evidenceBasis || rec.evidenceBasis.length === 0)
    ) {
      rejectedOrDropped.push({
        recommendationId: recId,
        title: rec.title,
        reason:
          'RECOMMENDATION_MISSING_EVIDENCE_BASIS: EVIDENCE_BACKED_ACTION requiere al menos un elemento en evidencia.',
        domain,
      });
      continue;
    }

    // Rule 2: PACKAGING_REVIEW requires package damage evidence
    if (domain === 'PACKAGING_REVIEW') {
      if (!hasPackageDamageEvidence) {
        rejectedOrDropped.push({
          recommendationId: recId,
          title: rec.title,
          reason:
            'RECOMMENDATION_DOMAIN_NOT_SUPPORTED: No existe evidencia ni hallazgo de quejas por daños en empaque.',
          domain,
        });
        continue;
      }

      // Ensure non-causal phrasing
      rec.description = rec.description.replace(
        /corregir las causas del embalaje deficiente/i,
        'Auditar el proceso de embalaje y manipulación para evaluar si contribuye a las quejas observadas.',
      );
    }

    // Rule 3: LOCAL_EXPLANATION_ANALYSIS requires available LOCAL_EXPLANATION component
    if (domain === 'LOCAL_EXPLANATION_ANALYSIS') {
      if (
        unavailableComponents.includes('LOCAL_EXPLANATION') ||
        !answeredComponents.includes('LOCAL_EXPLANATION')
      ) {
        rejectedOrDropped.push({
          recommendationId: recId,
          title: rec.title,
          reason:
            'RECOMMENDATION_REQUIRES_UNAVAILABLE_COMPONENT: Componente LOCAL_EXPLANATION no disponible.',
          domain,
        });
        continue;
      }
    }

    // Rule 4: ANOMALY_INVESTIGATION cannot be EVIDENCE_BACKED_ACTION (must be HYPOTHESIS_TO_TEST)
    if (domain === 'ANOMALY_INVESTIGATION') {
      if (rec.kind === 'EVIDENCE_BACKED_ACTION') {
        rec.kind = 'HYPOTHESIS_TO_TEST';
      }

      const reqs = rec.validationRequirements || [];
      const reqText =
        'Segmentar por ruta, vendedor, categoría, volumen y etapa. No inferir causalidad a partir del Z-Score.';
      if (!reqs.includes(reqText)) {
        reqs.push(reqText);
      }
      rec.validationRequirements = reqs;
    }

    acceptedRecommendations.push(rec);
  }

  return {
    acceptedRecommendations,
    rejectedOrDropped,
  };
}
