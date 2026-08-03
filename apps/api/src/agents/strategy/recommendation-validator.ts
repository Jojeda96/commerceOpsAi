import {
  Recommendation,
  Finding,
  Evidence,
  RecommendationKind,
} from '@commerce-ops/shared-types';
import { CAPABILITIES, CapabilitiesType } from './capability-registry';

export interface ValidationResult {
  recommendation: Recommendation;
  isModified: boolean;
  warnings: string[];
}

export function validateRecommendation(
  rec: Recommendation,
  findings: Finding[],
  evidence: Evidence[],
  capabilities: CapabilitiesType = CAPABILITIES,
): ValidationResult {
  const warnings: string[] = [];
  let isModified = false;

  let title = rec.title;
  let description = rec.description;
  let kind: RecommendationKind = rec.kind || 'HYPOTHESIS_TO_TEST';
  const evidenceBasis = rec.evidenceBasis || [];
  const validationRequirements = rec.validationRequirements || [];

  const text = `${title} ${description}`.toLowerCase();

  // 1. Prohibit real-time claims
  if (!capabilities.realTimeOrderIngestion && text.includes('tiempo real')) {
    title = title.replace(/en tiempo real/gi, 'monitoreo periódico');
    description = description.replace(
      /en tiempo real/gi,
      'con frecuencia periódica programada',
    );
    kind = 'MONITORING_ACTION';
    isModified = true;
    warnings.push(
      'Se reemplazó "tiempo real" por "monitoreo periódico" debido a límites de capacidad.',
    );
  }

  // 2. Carrier alternatives phrase requires external data hypothesis
  if (
    !capabilities.carrierIdentityAnalysis &&
    (text.includes('transportistas alternativos') ||
      text.includes('cambiar transportista'))
  ) {
    kind = 'HYPOTHESIS_TO_TEST';
    if (
      !validationRequirements.some((r) => r.includes('información externa'))
    ) {
      validationRequirements.push(
        'Requiere incorporar datos externos de transportistas, costo y SLA no disponibles en Olist.',
      );
    }
    isModified = true;
    warnings.push(
      'Recomendación de transportistas alternativos clasificada como HIPÓTESIS A VALIDAR.',
    );
  }

  // 3. Guaranteed reduction claims rewrite
  if (
    !capabilities.causalImpactEstimation &&
    (text.includes('garantizar') || text.includes('reducirá'))
  ) {
    description = description.replace(
      /garantizar una reducción/gi,
      'formular una hipótesis de optimización',
    );
    kind = 'HYPOTHESIS_TO_TEST';
    isModified = true;
    warnings.push('Causalidad directa reemplazada por hipótesis a validar.');
  }

  // 4. Default kind based on supporting findings
  if (!kind) {
    const supportingFindings = findings.filter((f) =>
      rec.supportingFindingIds.includes(f.id),
    );
    const hasDataQuality = supportingFindings.some(
      (f) =>
        f.findingType === 'MODEL_GOVERNANCE' ||
        f.operationalStatus === 'EXPERIMENTAL_CONTEXT',
    );
    if (hasDataQuality) {
      kind = 'DATA_QUALITY_ACTION';
    } else {
      kind = 'EVIDENCE_BACKED_ACTION';
    }
  }

  return {
    recommendation: {
      ...rec,
      title,
      description,
      kind,
      evidenceBasis,
      validationRequirements,
    },
    isModified,
    warnings,
  };
}
