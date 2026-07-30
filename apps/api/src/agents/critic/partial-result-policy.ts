import { ComponentCoverage } from './answer-coverage.audit';
import { ScopeConsistencyResult } from './scope-consistency.audit';

export interface PartialResultEvaluation {
  decision: 'APPROVED' | 'APPROVED_WITH_WARNINGS' | 'REQUIRES_MORE_ANALYSIS' | 'REJECTED';
  warnings: string[];
  reasons: string[];
}

export function evaluatePartialResultPolicy(
  scopeAudit: ScopeConsistencyResult,
  coverageAudit: ComponentCoverage[],
): PartialResultEvaluation {
  const warnings: string[] = [];
  const reasons: string[] = [];

  if (!scopeAudit.isConsistent) {
    return {
      decision: 'REJECTED',
      warnings: [],
      reasons: [scopeAudit.issueDescription || 'FINDINGS_USE_DIFFERENT_ANALYSIS_SCOPES'],
    };
  }

  const missingComponents = coverageAudit.filter((c) => c.status === 'MISSING');
  const unavailableComponents = coverageAudit.filter(
    (c) => c.status === 'UNAVAILABLE_WITH_REASON',
  );

  if (missingComponents.length > 0) {
    return {
      decision: 'REQUIRES_MORE_ANALYSIS',
      warnings,
      reasons: missingComponents.map(
        (m) => `Componente solicitado sin respuesta ni evidencia de indisponibilidad: ${m.component}`,
      ),
    };
  }

  if (unavailableComponents.length > 0) {
    for (const u of unavailableComponents) {
      warnings.push(
        `Componente ${u.component} no está disponible pero fue documentado con evidencia técnica.`,
      );
    }
    return {
      decision: 'APPROVED_WITH_WARNINGS',
      warnings,
      reasons: [],
    };
  }

  return {
    decision: 'APPROVED',
    warnings: [],
    reasons: [],
  };
}
