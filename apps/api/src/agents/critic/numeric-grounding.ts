import { Finding, Evidence, NumericClaim } from '@commerce-ops/shared-types';

export interface GroundingAuditViolation {
  code:
    | 'NUMERIC_CLAIM_NOT_GROUNDED'
    | 'MISSING_EVIDENCE_METRIC'
    | 'UNIT_MISMATCH'
    | 'NUMERIC_VALUE_MISMATCH';
  findingId: string;
  claim: NumericClaim;
  details: string;
}

export function auditNumericClaims(
  findings: Finding[],
  evidenceList: Evidence[],
): GroundingAuditViolation[] {
  const violations: GroundingAuditViolation[] = [];
  const evidenceMap = new Map<string, Evidence>(
    evidenceList.map((e) => [e.id, e]),
  );

  for (const finding of findings) {
    if (!finding.numericClaims || finding.numericClaims.length === 0) {
      continue;
    }

    for (const claim of finding.numericClaims) {
      const ev = evidenceMap.get(claim.evidenceId);
      if (!ev) {
        violations.push({
          code: 'NUMERIC_CLAIM_NOT_GROUNDED',
          findingId: finding.id,
          claim,
          details: `Evidence ID ${claim.evidenceId} referenced in numeric claim for metric '${claim.metricKey}' does not exist.`,
        });
        continue;
      }

      if (!ev.metrics || ev.metrics.length === 0) {
        violations.push({
          code: 'MISSING_EVIDENCE_METRIC',
          findingId: finding.id,
          claim,
          details: `Evidence ID ${claim.evidenceId} has no metrics array to ground claim '${claim.metricKey}'.`,
        });
        continue;
      }

      const metric = ev.metrics.find((m) => m.key === claim.metricKey);
      if (!metric) {
        violations.push({
          code: 'MISSING_EVIDENCE_METRIC',
          findingId: finding.id,
          claim,
          details: `Metric key '${claim.metricKey}' not found in Evidence ID ${claim.evidenceId}.`,
        });
        continue;
      }

      if (
        claim.unit &&
        metric.unit &&
        claim.unit.toLowerCase() !== metric.unit.toLowerCase()
      ) {
        violations.push({
          code: 'UNIT_MISMATCH',
          findingId: finding.id,
          claim,
          details: `Unit mismatch for '${claim.metricKey}': claim specifies '${claim.unit}', but evidence metric has '${metric.unit}'.`,
        });
      }

      const tol = claim.tolerance ?? 1e-4;
      const diff = Math.abs(claim.value - metric.value);
      if (diff > tol) {
        violations.push({
          code: 'NUMERIC_VALUE_MISMATCH',
          findingId: finding.id,
          claim,
          details: `Value mismatch for '${claim.metricKey}': claim states ${claim.value}, but evidence metric records ${metric.value} (diff ${diff} > tol ${tol}).`,
        });
      }
    }
  }

  return violations;
}
