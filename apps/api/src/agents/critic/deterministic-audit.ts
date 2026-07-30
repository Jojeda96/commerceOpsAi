import { CriticDecision, Finding, Evidence } from '@commerce-ops/shared-types';

export interface AuditResult {
  criticalErrors: string[];
  warnings: string[];
  perFinding: Record<string, { criticalErrors: string[]; warnings: string[] }>;
}

export function performDeterministicAudit(
  findings: Finding[],
  evidence: Evidence[],
): AuditResult {
  const criticalErrors: string[] = [];
  const warnings: string[] = [];
  const perFinding: Record<string, { criticalErrors: string[]; warnings: string[] }> = {};

  for (const f of findings) {
    const fCritical: string[] = [];
    const fWarnings: string[] = [];

    // Check 1: Finding has evidence linked
    const linked = evidence.filter((e) => (f.evidenceIds && f.evidenceIds.includes(e.id)));
    if (linked.length === 0) {
      fCritical.push(`El hallazgo "${f.title}" no posee ninguna evidencia registrada.`);
    } else {
      // Check 2: Linked evidence has valid non-empty resultSummary
      for (const e of linked) {
        if (!e.resultSummary || e.resultSummary.trim() === '') {
          fCritical.push(`La evidencia "${e.id}" para el hallazgo "${f.title}" contiene un resultado vacío.`);
        }
      }
    }

    // Check 3: Strictly causal terms warning
    const causalTerms = ['causó', 'provocó', 'demuestra que', 'debido únicamente a'];
    const text = `${f.title} ${f.description}`;
    const foundCausal = causalTerms.filter((term) => text.toLowerCase().includes(term));
    if (foundCausal.length > 0) {
      fWarnings.push(`El hallazgo "${f.title}" utiliza afirmaciones de causalidad estricta (${foundCausal.join(', ')}).`);
    }

    // Check 4: Detect hallucinated external variables not present in Olist dataset (weather, traffic, strikes, carrier workload)
    const hallucinatedTerms = ['clima', 'climática', 'climáticas', 'tráfico', 'huelga', 'carga de trabajo'];
    const foundHallucinated = hallucinatedTerms.filter((term) => text.toLowerCase().includes(term));
    if (foundHallucinated.length > 0) {
      fCritical.push(`El hallazgo "${f.title}" menciona variables no registradas en el dataset Olist (${foundHallucinated.join(', ')}).`);
    }

    // Check 5: Detect non-Data Science agents claiming SHAP values
    const agentName = f.agent || (f as any).agentName;
    if (agentName && agentName !== 'DATA_SCIENCE' && text.toLowerCase().includes('shap')) {
      fWarnings.push(`El agente ${agentName} menciona valores SHAP en "${f.title}", los cuales pertenecen exclusivamente a Data Science.`);
    }

    if (fCritical.length > 0) criticalErrors.push(...fCritical);
    if (fWarnings.length > 0) warnings.push(...fWarnings);

    perFinding[f.id] = { criticalErrors: fCritical, warnings: fWarnings };
  }

  return { criticalErrors, warnings, perFinding };
}

export function enforceDeterministicDecision(
  llmDecision: CriticDecision,
  audit: AuditResult,
): { decision: CriticDecision; enforcedReason?: string } {
  if (audit.criticalErrors.length > 0) {
    if (llmDecision === 'APPROVED') {
      return {
        decision: 'REQUIRES_MORE_ANALYSIS',
        enforcedReason: `Decisión forzada a REQUIRES_MORE_ANALYSIS por errores críticos deterministas: ${audit.criticalErrors.join(' | ')}`,
      };
    }
  }

  if (audit.warnings.length > 0 && llmDecision === 'APPROVED') {
    return {
      decision: 'APPROVED_WITH_WARNINGS',
      enforcedReason: `Decisión ajustada a APPROVED_WITH_WARNINGS por advertencias metodológicas: ${audit.warnings.join(' | ')}`,
    };
  }

  return { decision: llmDecision };
}
