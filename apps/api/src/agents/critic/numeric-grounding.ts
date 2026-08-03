import { Finding, Evidence, NumericClaim } from '@commerce-ops/shared-types';
import { findUncoveredNumbers } from './rendered-number-coverage';

export interface GroundingAuditViolation {
  code:
    | 'NUMERIC_CLAIM_NOT_GROUNDED'
    | 'MISSING_EVIDENCE_METRIC'
    | 'UNIT_MISMATCH'
    | 'NUMERIC_VALUE_MISMATCH'
    | 'UNDECLARED_RENDERED_NUMBER'
    | 'CLAIM_SOURCE_PATH_MISMATCH'
    | 'CLAIM_SAMPLE_SIZE_MISMATCH'
    | 'DUPLICATE_METRIC_SEMANTICS'
    | 'DERIVED_RATE_MISMATCH';
  findingId: string;
  claim?: NumericClaim;
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
    // 1. Check for rendered numbers in text description that lack a structured claim
    const uncoveredNumbers = findUncoveredNumbers(finding);
    for (const unc of uncoveredNumbers) {
      violations.push({
        code: 'UNDECLARED_RENDERED_NUMBER',
        findingId: finding.id,
        details: `Rendered number '${unc.rawText}' (val ${unc.value}) in finding description has no corresponding NumericClaim.`,
      });
    }

    if (!finding.numericClaims || finding.numericClaims.length === 0) {
      continue;
    }

    const seenMetricKeys = new Set<string>();

    for (const claim of finding.numericClaims) {
      if (seenMetricKeys.has(claim.metricKey)) {
        violations.push({
          code: 'DUPLICATE_METRIC_SEMANTICS',
          findingId: finding.id,
          claim,
          details: `Metric key '${claim.metricKey}' appears multiple times in the same finding with potentially conflicting semantics.`,
        });
      }
      seenMetricKeys.add(claim.metricKey);

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

      if (
        claim.sourcePath &&
        metric.sourcePath &&
        claim.sourcePath !== metric.sourcePath
      ) {
        violations.push({
          code: 'CLAIM_SOURCE_PATH_MISMATCH',
          findingId: finding.id,
          claim,
          details: `Source path mismatch for '${claim.metricKey}': claim specifies '${claim.sourcePath}', evidence specifies '${metric.sourcePath}'.`,
        });
      }

      if (
        claim.sampleSize !== undefined &&
        metric.sampleSize !== undefined &&
        claim.sampleSize !== metric.sampleSize
      ) {
        violations.push({
          code: 'CLAIM_SAMPLE_SIZE_MISMATCH',
          findingId: finding.id,
          claim,
          details: `Sample size mismatch for '${claim.metricKey}': claim specifies ${claim.sampleSize}, evidence metric has ${metric.sampleSize}.`,
        });
      }

      const tol = claim.tolerance ?? 0.05;
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

    // 2. Derived rate audit check across claims inside evidence (e.g. 5722 / 61779 = 9.3%, not 26.3%)
    const deliveredClaim = finding.numericClaims.find(
      (c) => c.metricKey === 'delivery.aggregate.delivered_orders',
    );
    const lateClaim = finding.numericClaims.find(
      (c) => c.metricKey === 'delivery.aggregate.late_orders',
    );
    const rateClaim = finding.numericClaims.find(
      (c) => c.metricKey === 'delivery.aggregate.late_rate_pct',
    );

    if (deliveredClaim && lateClaim && rateClaim && deliveredClaim.value > 0) {
      const expectedRate =
        Math.round((lateClaim.value / deliveredClaim.value) * 1000) / 10;
      if (Math.abs(expectedRate - rateClaim.value) > 0.1) {
        violations.push({
          code: 'DERIVED_RATE_MISMATCH',
          findingId: finding.id,
          claim: rateClaim,
          details: `Derived rate mismatch: ${lateClaim.value} late / ${deliveredClaim.value} delivered = ${expectedRate}%, but claim states ${rateClaim.value}%.`,
        });
      }
    }
  }

  return violations;
}
