import { Finding, Evidence } from '@commerce-ops/shared-types';

export interface ScopeConsistencyResult {
  isConsistent: boolean;
  uniqueScopeHashes: string[];
  inconsistentFindingIds: string[];
  issueDescription?: string;
}

export function auditScopeConsistency(
  findings: Finding[],
  evidenceList: Evidence[],
): ScopeConsistencyResult {
  const activeFindings = findings.filter((f) => f.status !== 'SUPERSEDED');
  const scopeHashes = new Set<string>();
  const inconsistentFindingIds: string[] = [];

  for (const finding of activeFindings) {
    for (const evId of finding.evidenceIds || []) {
      const ev = evidenceList.find((e) => e.id === evId);
      if (ev) {
        const hash = (ev.parameters as any)?.scopeHash || (ev as any).scopeHash;
        if (hash) {
          scopeHashes.add(hash);
        }
      }
    }
  }

  const uniqueScopeHashes = Array.from(scopeHashes);
  const isConsistent = uniqueScopeHashes.length <= 1;

  return {
    isConsistent,
    uniqueScopeHashes,
    inconsistentFindingIds,
    issueDescription: !isConsistent
      ? `Se detectaron múltiples AnalysisScope hashes en una misma iteración: ${uniqueScopeHashes.join(', ')}.`
      : undefined,
  };
}
