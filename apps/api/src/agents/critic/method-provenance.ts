import { Finding, Evidence, AnalysisMethod } from '@commerce-ops/shared-types';

export const TOOL_METHOD_REGISTRY: Record<string, AnalysisMethod[]> = {
  get_delivery_summary: ['DESCRIPTIVE_AGGREGATION'],
  get_delivery_performance_by_route: ['ROUTE_AGGREGATION'],
  get_delivery_stage_breakdown: ['STAGE_BREAKDOWN'],
  detect_metric_anomalies: ['ROBUST_Z_SCORE'],
  predict_delivery_delay: ['MODEL_INFERENCE'],
  explain_delivery_delay: ['LOCAL_SHAP', 'LINEAR_CONTRIBUTION'],
};

export interface MethodProvenanceViolation {
  code: 'UNSUPPORTED_METHOD_CLAIM' | 'INVALID_METHOD_FOR_TOOL';
  findingId: string;
  method?: string;
  details: string;
}

export function auditMethodProvenance(
  findings: Finding[],
  evidenceList: Evidence[],
): MethodProvenanceViolation[] {
  const violations: MethodProvenanceViolation[] = [];
  const evidenceMap = new Map<string, Evidence>(
    evidenceList.map((e) => [e.id, e]),
  );

  for (const finding of findings) {
    const normText = (finding.description || '').toLowerCase();

    // Check for mentions of Z-Score in text
    const mentionsZScore = /\bz-?score\b|puntuaci[oó]n z/i.test(normText);
    if (mentionsZScore) {
      const hasZScoreEvidence = evidenceList.some(
        (e) =>
          e.toolName === 'detect_metric_anomalies' &&
          finding.evidenceIds.includes(e.id),
      );

      if (!hasZScoreEvidence) {
        violations.push({
          code: 'UNSUPPORTED_METHOD_CLAIM',
          findingId: finding.id,
          method: 'ROBUST_Z_SCORE',
          details: `El hallazgo '${finding.title}' de ${finding.agent} menciona Z-Score pero no cuenta con evidencia emitida por detect_metric_anomalies.`,
        });
      }
    }

    // Check for SHAP mentions
    const mentionsShap = /\bshap\b/i.test(normText);
    if (mentionsShap) {
      const hasShapEvidence = evidenceList.some(
        (e) =>
          e.toolName === 'explain_delivery_delay' &&
          finding.evidenceIds.includes(e.id),
      );

      if (!hasShapEvidence) {
        violations.push({
          code: 'UNSUPPORTED_METHOD_CLAIM',
          findingId: finding.id,
          method: 'LOCAL_SHAP',
          details: `El hallazgo menciona factores SHAP pero no cuenta con evidencia de explain_delivery_delay.`,
        });
      }
    }

    // Audit claimed methods vs tool execution
    if (finding.methodClaims) {
      for (const mc of finding.methodClaims) {
        const ev = evidenceMap.get(mc.evidenceId);
        if (ev) {
          const allowedMethods = TOOL_METHOD_REGISTRY[ev.toolName] || [];
          if (!allowedMethods.includes(mc.method)) {
            violations.push({
              code: 'INVALID_METHOD_FOR_TOOL',
              findingId: finding.id,
              method: mc.method,
              details: `El método '${mc.method}' no puede ser atribuido a la herramienta '${ev.toolName}'.`,
            });
          }
        }
      }
    }
  }

  return violations;
}
