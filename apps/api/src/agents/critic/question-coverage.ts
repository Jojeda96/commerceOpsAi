import {
  AgentName,
  Finding,
  Evidence,
  AnswerComponent,
  AnswerCoverageItem,
} from '@commerce-ops/shared-types';

export type QuestionCoverageViolationCode =
  | 'MISSING_REQUIRED_AGENT'
  | 'MISSING_REQUIRED_TOOL'
  | 'MISSING_REQUIRED_FINDING_TYPE'
  | 'QUESTION_COMPONENT_NOT_ANSWERED'
  | 'COMPONENT_STATUS_WITHOUT_REASON'
  | 'COMPONENT_EVIDENCE_MISSING';

export interface QuestionCoverageViolation {
  code: QuestionCoverageViolationCode;
  severity: 'CRITICAL' | 'WARNING';
  component?: AnswerComponent;
  details: string;
}

export interface QuestionCoverageAuditInput {
  userQuestion: string;
  requiredCapabilities: string[];
  requiredAnswerComponents: AnswerComponent[];
  selectedAgents: AgentName[];
  findings: Finding[];
  evidence: Evidence[];
  answerCoverage: AnswerCoverageItem[];
}

export interface QuestionCoverageAuditResult {
  passed: boolean;
  score: number;
  violations: QuestionCoverageViolation[];
  missingAgents: AgentName[];
}

// Reason codes that are non-retryable - validly unavailable
const NON_RETRYABLE_REASON_CODES = new Set([
  'SNAPSHOT_TABLE_EMPTY',
  'NO_SCENARIOS_MATCH_FILTERS',
  'MODEL_EXPERIMENTAL_NOT_APPROVED',
  'NO_VALID_PREDICTION',
  'LOCAL_EXPLANATION_NOT_PRODUCED',
  'NO_DELIVERIES_IN_SCOPE',
  'NO_RATINGS_IN_SCOPE',
  'ANOMALY_ANALYSIS_UNAVAILABLE',
  'DELIVERY_SUMMARY_FAILED',
  'NO_DELIVERY_DELAY_COMPLAINTS_IN_SCOPE',
  'NO_PACKAGE_DAMAGE_COMPLAINTS_IN_SCOPE',
]);

export function auditQuestionCoverage(
  input: QuestionCoverageAuditInput,
): QuestionCoverageAuditResult {
  const {
    requiredCapabilities,
    requiredAnswerComponents,
    selectedAgents,
    findings,
    evidence,
    answerCoverage,
  } = input;

  const violations: QuestionCoverageViolation[] = [];
  const missingAgentsSet = new Set<AgentName>();

  // 1. Capability to Required Agent & Tool checks
  const isReviewComplaintQuery =
    requiredCapabilities.includes('REVIEW_COMPLAINT_ANALYSIS') ||
    requiredAnswerComponents.some((c) =>
      [
        'REVIEW_COMPLAINT_THEMES',
        'DELIVERY_DELAY_COMPLAINTS',
        'PACKAGE_DAMAGE_COMPLAINTS',
      ].includes(c),
    );

  if (isReviewComplaintQuery) {
    if (!selectedAgents.includes('CUSTOMER_EXPERIENCE')) {
      violations.push({
        code: 'MISSING_REQUIRED_AGENT',
        severity: 'CRITICAL',
        component: 'REVIEW_COMPLAINT_THEMES',
        details:
          'La investigación requiere el agente CUSTOMER_EXPERIENCE para responder quejas en reseñas.',
      });
      missingAgentsSet.add('CUSTOMER_EXPERIENCE');
    }

    const hasComplaintTool = evidence.some(
      (e) => e.toolName === 'analyze_review_complaints',
    );
    if (!hasComplaintTool) {
      violations.push({
        code: 'MISSING_REQUIRED_TOOL',
        severity: 'CRITICAL',
        component: 'REVIEW_COMPLAINT_THEMES',
        details:
          'Se requiere la ejecución de la herramienta analyze_review_complaints.',
      });
    }

    const hasComplaintFinding = findings.some(
      (f) =>
        f.findingType === 'REVIEW_COMPLAINT_ANALYSIS' ||
        (f as any).type === 'REVIEW_COMPLAINT_ANALYSIS',
    );
    if (!hasComplaintFinding) {
      violations.push({
        code: 'MISSING_REQUIRED_FINDING_TYPE',
        severity: 'CRITICAL',
        component: 'REVIEW_COMPLAINT_THEMES',
        details:
          'Se requiere un hallazgo de tipo REVIEW_COMPLAINT_ANALYSIS para satisfacer las quejas de reseñas.',
      });
    }
  }

  // 2. Component-by-Component Coverage Audit
  const coverageMap = new Map<AnswerComponent, AnswerCoverageItem>();
  for (const item of answerCoverage) {
    coverageMap.set(item.component, item);
  }

  // Helper function to check if evidence has a specific metric key
  const hasMetricKey = (e: Evidence, key: string): boolean => {
    if (!e.metrics) return false;
    if (Array.isArray(e.metrics)) {
      return (e.metrics as any[]).some((m) => m && m.key === key);
    }
    return (e.metrics as Record<string, any>)[key] !== undefined;
  };

  for (const component of requiredAnswerComponents) {
    const coverageItem = coverageMap.get(component);

    if (!coverageItem) {
      // Deduce coverage dynamically if not explicitly provided
      let isAnswered = false;
      let isReasonedUnavailable = false;

      if (component === 'REVIEW_COMPLAINT_THEMES') {
        isAnswered = findings.some(
          (f) =>
            f.findingType === 'REVIEW_COMPLAINT_ANALYSIS' ||
            (f as any).type === 'REVIEW_COMPLAINT_ANALYSIS',
        );
      } else if (component === 'DELIVERY_DELAY_COMPLAINTS') {
        const hasMetric = evidence.some(
          (e) =>
            hasMetricKey(e, 'reviews.topic.delivery_delay.count') ||
            hasMetricKey(e, 'reviews.comments.total'),
        );
        const hasFinding = findings.some(
          (f) =>
            f.agent === 'CUSTOMER_EXPERIENCE' ||
            (f as any).agentName === 'CUSTOMER_EXPERIENCE',
        );
        isAnswered = hasMetric || hasFinding;
      } else if (component === 'PACKAGE_DAMAGE_COMPLAINTS') {
        const hasMetric = evidence.some(
          (e) =>
            hasMetricKey(e, 'reviews.topic.package_damage.count') ||
            hasMetricKey(e, 'reviews.comments.total'),
        );
        const hasFinding = findings.some(
          (f) =>
            f.agent === 'CUSTOMER_EXPERIENCE' ||
            (f as any).agentName === 'CUSTOMER_EXPERIENCE',
        );
        isAnswered = hasMetric || hasFinding;
      } else if (component === 'HISTORICAL_LOGISTICS_CONTEXT') {
        // Deduce from logistics findings and evidence
        const hasLogisticsFinding = findings.some(
          (f) => f.agent === 'LOGISTICS' && f.findingType === 'LOGISTICS_DELAY',
        );
        const hasLogisticsEvidence = evidence.some(
          (e) =>
            e.agentName === 'LOGISTICS' &&
            e.toolName === 'get_delivery_summary' &&
            e.status === 'AVAILABLE',
        );
        const hasAnyLogisticsEvidence = evidence.some(
          (e) => e.agentName === 'LOGISTICS',
        );
        isAnswered = hasLogisticsFinding && hasLogisticsEvidence;
        // If logistics ran but data is unavailable, treat as reasoned
        isReasonedUnavailable = hasAnyLogisticsEvidence && !isAnswered;
      } else if (component === 'ANOMALY_DETECTION') {
        const hasAnomalyFinding = findings.some((f) => f.agent === 'ANOMALY');
        const hasAnomalyEvidence = evidence.some(
          (e) => e.agentName === 'ANOMALY',
        );
        isAnswered = hasAnomalyFinding;
        isReasonedUnavailable = hasAnomalyEvidence && !isAnswered;
      } else if (component === 'PREDICTION') {
        const hasDsFinding = findings.some(
          (f) =>
            f.agent === 'DATA_SCIENCE' ||
            (f as any).agentName === 'DATA_SCIENCE',
        );
        isAnswered = hasDsFinding;
        // DS always produces a finding (even for partial answers)
        isReasonedUnavailable = hasDsFinding;
      } else if (component === 'LOCAL_EXPLANATION') {
        const hasShapFinding = findings.some(
          (f) => (f as any).findingType === 'LOCAL_EXPLANATION',
        );
        isAnswered = hasShapFinding;
        // If DS ran but no SHAP, it's reasonably unavailable
        const hasDsEvidence = evidence.some(
          (e) => e.agentName === 'DATA_SCIENCE',
        );
        isReasonedUnavailable = hasDsEvidence && !isAnswered;
      } else if (component === 'MODEL_GOVERNANCE') {
        const hasGovFinding = findings.some(
          (f) =>
            f.agent === 'DATA_SCIENCE' &&
            (f.findingType === 'MODEL_GOVERNANCE' ||
              f.findingType === 'ML_PREDICTION'),
        );
        const hasGovEvidence = evidence.some(
          (e) =>
            e.agentName === 'DATA_SCIENCE' &&
            e.toolName === 'get_delivery_model_governance',
        );
        isAnswered = hasGovFinding && hasGovEvidence;
        isReasonedUnavailable = hasGovEvidence && !isAnswered;
      }

      if (!isAnswered && !isReasonedUnavailable) {
        violations.push({
          code: 'QUESTION_COMPONENT_NOT_ANSWERED',
          severity: 'CRITICAL',
          component,
          details: `El componente requerido "${component}" no fue respondido en esta investigación.`,
        });
      }
    } else {
      // Explicit coverage item exists
      if (coverageItem.status === 'UNANSWERED') {
        violations.push({
          code: 'QUESTION_COMPONENT_NOT_ANSWERED',
          severity: 'CRITICAL',
          component,
          details: `El componente "${component}" fue registrado como no respondido (UNANSWERED).`,
        });
      } else if (
        (coverageItem.status === 'NO_DATA_WITH_REASON' ||
          coverageItem.status === 'UNAVAILABLE_WITH_REASON') &&
        !coverageItem.reasonCode
      ) {
        // Missing reasonCode is a warning, not critical
        violations.push({
          code: 'COMPONENT_STATUS_WITHOUT_REASON',
          severity: 'WARNING',
          component,
          details: `El componente "${component}" posee un estado de indisponibilidad sin un reasonCode explícito.`,
        });
      } else if (
        coverageItem.status === 'ANSWERED' &&
        (!coverageItem.evidenceIds || coverageItem.evidenceIds.length === 0)
      ) {
        // ANSWERED must have valid linked evidence IDs
        violations.push({
          code: 'COMPONENT_EVIDENCE_MISSING',
          severity: 'CRITICAL',
          component,
          details: `El componente respondido "${component}" no posee evidencias asociadas.`,
        });
      } else if (
        coverageItem.status === 'ANSWERED' &&
        coverageItem.evidenceIds &&
        coverageItem.evidenceIds.length > 0
      ) {
        // Verify at least one evidence ID actually exists in the evidence list
        const linkedEvidenceExists = coverageItem.evidenceIds.some((id) =>
          evidence.some((e) => e.id === id),
        );
        if (!linkedEvidenceExists && evidence.length > 0) {
          violations.push({
            code: 'COMPONENT_EVIDENCE_MISSING',
            severity: 'CRITICAL',
            component,
            details: `El componente respondido "${component}" referencia evidencias que no existen en la investigación.`,
          });
        }
      }
      // NO_DATA_WITH_REASON and UNAVAILABLE_WITH_REASON with reasonCode are valid - no critical violation
    }
  }

  const criticalCount = violations.filter(
    (v) => v.severity === 'CRITICAL',
  ).length;
  const warningCount = violations.filter(
    (v) => v.severity === 'WARNING',
  ).length;

  const passed = criticalCount === 0;
  const score = Math.max(0, 100 - criticalCount * 30 - warningCount * 10);

  return {
    passed,
    score,
    violations,
    missingAgents: Array.from(missingAgentsSet),
  };
}
