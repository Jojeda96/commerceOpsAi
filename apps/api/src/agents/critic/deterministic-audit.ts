import {
  Finding,
  Evidence,
  FindingAuditStatus,
  CriticDecision,
  AgentName,
  AnswerComponent,
  AnswerCoverageItem,
} from '@commerce-ops/shared-types';
import { auditNumericClaims } from './numeric-grounding';
import { auditMethodProvenance } from './method-provenance';
import { auditSemanticMetricPolicy } from './semantic-metric-policy';
import { auditCrossEvidenceConsistency } from './cross-evidence-consistency';
import { calculateDeterministicEvidenceQuality } from './evidence-quality';
import { FindingAuditResult } from './finding-audit-result';
import { auditQuestionCoverage, QuestionCoverageAuditResult } from './question-coverage';

export interface AuditResult {
  criticalErrors: string[];
  warnings: string[];
  perFindingResults: FindingAuditResult[];
  perFinding: Record<string, { criticalErrors: string[]; warnings: string[] }>;
  coverageAudit?: QuestionCoverageAuditResult;
  missingAgents?: AgentName[];
}

export interface DeterministicAuditOptions {
  userQuestion?: string;
  requiredCapabilities?: string[];
  requiredAnswerComponents?: AnswerComponent[];
  selectedAgents?: AgentName[];
  findings: Finding[];
  evidence: Evidence[];
  answerCoverage?: AnswerCoverageItem[];
}

export function performDeterministicAudit(
  findingsOrOptions: Finding[] | DeterministicAuditOptions,
  evidenceParam?: Evidence[],
): AuditResult {
  let findings: Finding[];
  let evidence: Evidence[];
  let options: DeterministicAuditOptions | undefined;

  if (Array.isArray(findingsOrOptions)) {
    findings = findingsOrOptions;
    evidence = evidenceParam || [];
  } else {
    options = findingsOrOptions;
    findings = options.findings;
    evidence = options.evidence;
  }

  const criticalErrors: string[] = [];
  const warnings: string[] = [];
  const perFindingResults: FindingAuditResult[] = [];
  const perFinding: Record<
    string,
    { criticalErrors: string[]; warnings: string[] }
  > = {};

  let coverageAudit: QuestionCoverageAuditResult | undefined;
  let missingAgents: AgentName[] = [];

  if (options && options.userQuestion) {
    coverageAudit = auditQuestionCoverage({
      userQuestion: options.userQuestion,
      requiredCapabilities: options.requiredCapabilities || [],
      requiredAnswerComponents: options.requiredAnswerComponents || [],
      selectedAgents: options.selectedAgents || [],
      findings,
      evidence,
      answerCoverage: options.answerCoverage || [],
    });

    for (const v of coverageAudit.violations) {
      if (v.severity === 'CRITICAL') {
        criticalErrors.push(`[${v.code}] ${v.details}`);
      } else {
        warnings.push(`[${v.code}] ${v.details}`);
      }
    }
    missingAgents = coverageAudit.missingAgents;
  }

  // 1. Audits across findings and evidence
  const numericViolations = auditNumericClaims(findings, evidence);
  const methodViolations = auditMethodProvenance(findings, evidence);
  const semanticViolations = auditSemanticMetricPolicy(findings);
  const crossEvidenceViolations = auditCrossEvidenceConsistency(
    findings,
    evidence,
  );

  for (const f of findings) {
    const fCritical: string[] = [];
    const fWarnings: string[] = [];

    // Filter violations for this finding
    const fNum = numericViolations.filter((v) => v.findingId === f.id);
    for (const nv of fNum) {
      fCritical.push(`[${nv.code}] ${nv.details}`);
    }

    const fMeth = methodViolations.filter((v) => v.findingId === f.id);
    for (const mv of fMeth) {
      fCritical.push(`[${mv.code}] ${mv.details}`);
    }

    const fSem = semanticViolations.filter((v) => v.findingId === f.id);
    for (const sv of fSem) {
      fCritical.push(`[${sv.code}] ${sv.details}`);
    }

    const fCross = crossEvidenceViolations.filter((v) => v.findingId === f.id);
    for (const cv of fCross) {
      fCritical.push(`[${cv.code}] ${cv.details}`);
    }

    // Check evidence linkage
    const linked = evidence.filter(
      (e) => f.evidenceIds && f.evidenceIds.includes(e.id),
    );
    const hasTechnicalEv = evidence.some((e) => e.agentName === f.agent);

    if (
      linked.length === 0 &&
      !hasTechnicalEv &&
      f.findingType !== 'MODEL_GOVERNANCE'
    ) {
      fCritical.push(
        `El hallazgo "${f.title}" no posee ninguna evidencia registrada.`,
      );
    }

    // Check for hallucinated terms
    const hallucinatedTerms = [
      'clima',
      'climática',
      'tráfico',
      'huelga',
      'carga de trabajo',
    ];
    const text = `${f.title} ${f.description}`.toLowerCase();
    const foundHallucinated = hallucinatedTerms.filter((t) => text.includes(t));
    if (foundHallucinated.length > 0) {
      fCritical.push(
        `El hallazgo "${f.title}" menciona variables externas no presentes en Olist: ${foundHallucinated.join(', ')}.`,
      );
    }

    // Governance checks
    if (f.findingType === 'MODEL_GOVERNANCE') {
      fWarnings.push(
        'Gobernanza del modelo: Despliegue experimental sin escenario de predicción activo.',
      );
    }

    criticalErrors.push(...fCritical);
    warnings.push(...fWarnings);

    perFinding[f.id] = { criticalErrors: fCritical, warnings: fWarnings };

    let auditStatus: FindingAuditStatus = 'APPROVED';
    if (fCritical.length > 0) {
      auditStatus = 'REJECTED';
    } else if (fWarnings.length > 0) {
      auditStatus = 'APPROVED_WITH_WARNINGS';
    }

    const evidenceQuality = calculateDeterministicEvidenceQuality(f, evidence);

    perFindingResults.push({
      findingId: f.id,
      status: auditStatus,
      errors: fCritical,
      warnings: fWarnings,
      evidenceQuality,
    });
  }

  return {
    criticalErrors,
    warnings,
    perFindingResults,
    perFinding,
    coverageAudit,
    missingAgents,
  };
}

export function enforceDeterministicDecision(
  rawDecision: CriticDecision,
  audit: AuditResult,
): { decision: CriticDecision; enforcedReason?: string } {
  if (audit.criticalErrors.length > 0) {
    if (
      rawDecision === 'APPROVED' ||
      rawDecision === 'APPROVED_WITH_WARNINGS'
    ) {
      return {
        decision: 'REQUIRES_MORE_ANALYSIS',
        enforcedReason: `Decisión sobrescrita por el Evidence Critic: Existen ${audit.criticalErrors.length} alerta(s) determinista(s) crítica(s).`,
      };
    }
  }
  return { decision: rawDecision };
}
