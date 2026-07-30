import { Finding, Evidence, NumericClaim } from '@commerce-ops/shared-types';

export interface NumericClaimAuditResult {
  isValid: boolean;
  mismatchedClaims: NumericClaim[];
}

export function auditNumericClaims(
  findings: Finding[],
  evidenceList: Evidence[],
): NumericClaimAuditResult {
  const activeFindings = findings.filter((f) => f.status !== 'SUPERSEDED');
  const mismatchedClaims: NumericClaim[] = [];

  for (const finding of activeFindings) {
    for (const claim of finding.numericClaims || []) {
      const ev = evidenceList.find((e) => e.id === claim.evidenceId);
      if (!ev) {
        mismatchedClaims.push(claim);
        continue;
      }

      if (ev.metrics && ev.metrics.length > 0) {
        const metric = ev.metrics.find((m) => m.key === claim.metricKey);
        if (metric && claim.tolerance !== undefined) {
          const diff = Math.abs(metric.value - claim.value);
          if (diff > claim.tolerance) {
            mismatchedClaims.push(claim);
          }
        }
      }
    }
  }

  return {
    isValid: mismatchedClaims.length === 0,
    mismatchedClaims,
  };
}
