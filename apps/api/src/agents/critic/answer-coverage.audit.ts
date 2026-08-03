import { Finding, Evidence } from '@commerce-ops/shared-types';

export type ComponentType =
  | 'HISTORICAL_CONTEXT'
  | 'PREDICTION'
  | 'MODEL_GOVERNANCE'
  | 'LOCAL_EXPLANATION';

export interface ComponentCoverage {
  component: ComponentType;
  status: 'ANSWERED' | 'UNAVAILABLE_WITH_REASON' | 'MISSING';
  evidenceIds: string[];
}

export function auditAnswerCoverage(
  userQuestion: string,
  findings: Finding[],
  evidenceList: Evidence[],
): ComponentCoverage[] {
  const activeFindings = findings.filter((f) => f.status !== 'SUPERSEDED');
  const text = userQuestion.toLowerCase();

  const isPredictiveRequested =
    /probabilidad predictiva|predicci[oó]n|riesgo/i.test(text);
  const isGovernanceRequested =
    /gobernanza|estado del modelo|quality gate/i.test(text);
  const isShapRequested = /shap|factor(?:es)? de impacto|explicaci[oó]n/i.test(
    text,
  );

  const coverage: ComponentCoverage[] = [];

  // Historical Context
  const hasLogistics = activeFindings.some(
    (f) => f.agent === 'LOGISTICS' || (f as any).agentName === 'LOGISTICS',
  );
  coverage.push({
    component: 'HISTORICAL_CONTEXT',
    status: hasLogistics ? 'ANSWERED' : 'MISSING',
    evidenceIds: activeFindings
      .filter((f) => f.agent === 'LOGISTICS')
      .flatMap((f) => f.evidenceIds),
  });

  // Model Governance
  if (isGovernanceRequested || isPredictiveRequested) {
    const hasGov = activeFindings.some(
      (f) =>
        f.findingType === 'MODEL_GOVERNANCE' || f.modelGovernance !== undefined,
    );
    coverage.push({
      component: 'MODEL_GOVERNANCE',
      status: hasGov ? 'ANSWERED' : 'MISSING',
      evidenceIds: activeFindings
        .filter((f) => f.findingType === 'MODEL_GOVERNANCE')
        .flatMap((f) => f.evidenceIds),
    });
  }

  // Prediction
  if (isPredictiveRequested) {
    const hasPredictionFinding = activeFindings.some(
      (f) => f.findingType === 'ML_PREDICTION',
    );
    const hasUnavailableFinding = activeFindings.some(
      (f) =>
        f.findingType === 'ML_UNAVAILABLE' || f.operationalStatus === 'BLOCKED',
    );
    coverage.push({
      component: 'PREDICTION',
      status: hasPredictionFinding
        ? 'ANSWERED'
        : hasUnavailableFinding
          ? 'UNAVAILABLE_WITH_REASON'
          : 'MISSING',
      evidenceIds: activeFindings
        .filter(
          (f) =>
            f.findingType === 'ML_PREDICTION' ||
            f.findingType === 'ML_UNAVAILABLE',
        )
        .flatMap((f) => f.evidenceIds),
    });
  }

  // Local Explanation / SHAP
  if (isShapRequested) {
    const hasPrediction = activeFindings.some(
      (f) => f.findingType === 'ML_PREDICTION',
    );
    const hasUnavailablePrediction = activeFindings.some(
      (f) =>
        f.findingType === 'ML_UNAVAILABLE' || f.operationalStatus === 'BLOCKED',
    );
    coverage.push({
      component: 'LOCAL_EXPLANATION',
      status: hasPrediction
        ? 'ANSWERED'
        : hasUnavailablePrediction
          ? 'UNAVAILABLE_WITH_REASON'
          : 'MISSING',
      evidenceIds: activeFindings
        .filter((f) => f.findingType === 'ML_PREDICTION')
        .flatMap((f) => f.evidenceIds),
    });
  }

  return coverage;
}
