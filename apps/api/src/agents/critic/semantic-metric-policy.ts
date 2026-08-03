import { Finding } from '@commerce-ops/shared-types';

export interface SemanticPolicyViolation {
  code: 'HISTORICAL_CALLED_PREDICTIVE' | 'ROUTE_MEAN_CALLED_AGGREGATE';
  findingId: string;
  details: string;
}

export function auditSemanticMetricPolicy(
  findings: Finding[],
): SemanticPolicyViolation[] {
  const violations: SemanticPolicyViolation[] = [];

  for (const finding of findings) {
    const text = (finding.description || '').toLowerCase();

    if (finding.agent === 'LOGISTICS') {
      const mentionsProb =
        /probabilidad predictiva|predicci[oó]n del modelo|probabilidad de atraso/i.test(
          text,
        );
      if (mentionsProb) {
        violations.push({
          code: 'HISTORICAL_CALLED_PREDICTIVE',
          findingId: finding.id,
          details: `El hallazgo de Logistics presenta una tasa histórica como probabilidad predictiva del modelo.`,
        });
      }

      const callsRouteMeanAggregate =
        /promedio simple.*tasa agregada|tasa interestatal es 26\.3%/i.test(
          text,
        );
      if (callsRouteMeanAggregate) {
        violations.push({
          code: 'ROUTE_MEAN_CALLED_AGGREGATE',
          findingId: finding.id,
          details: `El hallazgo presenta el promedio simple de tasas por ruta como si fuera la tasa agregada interestatal.`,
        });
      }
    }
  }

  return violations;
}
