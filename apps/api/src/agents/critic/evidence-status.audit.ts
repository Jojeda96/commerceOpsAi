import { Finding, Evidence } from '@commerce-ops/shared-types';

export interface EvidenceStatusAuditResult {
  hasValidTechnicalEvidence: boolean;
  unbackedFindingIds: string[];
}

export function auditEvidenceStatus(
  findings: Finding[],
  evidenceList: Evidence[],
): EvidenceStatusAuditResult {
  const activeFindings = findings.filter((f) => f.status !== 'SUPERSEDED');
  const unbackedFindingIds: string[] = [];

  for (const finding of activeFindings) {
    if (!finding.evidenceIds || finding.evidenceIds.length === 0) {
      // If operationalStatus is UNAVAILABLE or BLOCKED or EXPERIMENTAL_CONTEXT, check if technical evidence exists in evidenceList
      const hasTechEv = evidenceList.some(
        (e) => e.agentName === finding.agent || (e as any).toolName,
      );
      if (!hasTechEv) {
        unbackedFindingIds.push(finding.id);
      }
    }
  }

  return {
    hasValidTechnicalEvidence: unbackedFindingIds.length === 0,
    unbackedFindingIds,
  };
}
