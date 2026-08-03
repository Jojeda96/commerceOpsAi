import { Finding, Evidence } from '@commerce-ops/shared-types';

export interface CrossEvidenceViolation {
  code: 'SCOPE_HASH_MISMATCH' | 'AGGREGATE_ROUTE_PARITY_MISMATCH';
  findingId: string;
  details: string;
}

export function auditCrossEvidenceConsistency(
  findings: Finding[],
  evidenceList: Evidence[],
): CrossEvidenceViolation[] {
  const violations: CrossEvidenceViolation[] = [];
  const evidenceMap = new Map<string, Evidence>(
    evidenceList.map((e) => [e.id, e]),
  );

  for (const finding of findings) {
    const linkedEv = evidenceList.filter((e) =>
      finding.evidenceIds.includes(e.id),
    );
    if (linkedEv.length > 1) {
      const hashes = new Set(linkedEv.map((e) => e.scopeHash).filter(Boolean));
      if (hashes.size > 1) {
        violations.push({
          code: 'SCOPE_HASH_MISMATCH',
          findingId: finding.id,
          details: `El hallazgo combina evidencias con diferentes hashes de scope: ${Array.from(hashes).join(', ')}.`,
        });
      }
    }

    const summaryEv = linkedEv.find(
      (e) => e.toolName === 'get_delivery_summary',
    );
    const routeEv = linkedEv.find(
      (e) => e.toolName === 'get_delivery_performance_by_route',
    );

    if (summaryEv && routeEv) {
      const sumMetric = summaryEv.metrics?.find(
        (m) => m.key === 'delivery.aggregate.late_rate_pct',
      );
      const routeMetric = routeEv.metrics?.find(
        (m) => m.key === 'delivery.routes.weighted_late_rate_pct',
      );

      if (sumMetric && routeMetric) {
        if (Math.abs(sumMetric.value - routeMetric.value) > 0.1) {
          violations.push({
            code: 'AGGREGATE_ROUTE_PARITY_MISMATCH',
            findingId: finding.id,
            details: `La tasa agregada (${sumMetric.value}%) difiere de la tasa ponderada de rutas (${routeMetric.value}%).`,
          });
        }
      }
    }
  }

  return violations;
}
