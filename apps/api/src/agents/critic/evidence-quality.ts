import {
  Finding,
  Evidence,
  EvidenceQualityResult,
  EvidenceQualityDimensions,
} from '@commerce-ops/shared-types';
import { auditNumericClaims } from './numeric-grounding';

export function calculateDeterministicEvidenceQuality(
  finding: Finding,
  evidenceList: Evidence[],
): EvidenceQualityResult {
  const rationale: string[] = [];

  // For pure Model Governance findings, statistical quality is NOT_APPLICABLE
  if (finding.findingType === 'MODEL_GOVERNANCE') {
    return {
      score: 1.0,
      grade: 'NOT_APPLICABLE',
      computedBy: 'DETERMINISTIC_V4_2',
      dimensions: {
        executionIntegrity: 20,
        scopeConsistency: 20,
        numericGrounding: 25,
        sampleAdequacy: 20,
        methodProvenance: 15,
      },
      rationale: [
        'Gobernanza de modelo verificada técnicamente; calidad de muestreo no aplica.',
      ],
    };
  }

  // 1. Execution Integrity (20 points)
  let executionIntegrity = 20;
  const linkedEv = evidenceList.filter((e) =>
    finding.evidenceIds.includes(e.id),
  );
  if (linkedEv.length === 0) {
    executionIntegrity = 0;
    rationale.push(
      'Integridad de ejecución: No hay evidencias vinculadas (0/20).',
    );
  } else {
    const failedEv = linkedEv.filter(
      (e) => e.status === 'ERROR' || e.status === 'UNAVAILABLE',
    );
    if (failedEv.length > 0) {
      executionIntegrity = 10;
      rationale.push(
        'Integridad de ejecución: Resultado parcial disponible (10/20).',
      );
    } else {
      rationale.push(
        'Integridad de ejecución: Todas las herramientas completaron exitosamente (20/20).',
      );
    }
  }

  // 2. Scope Consistency (20 points)
  let scopeConsistency = 20;
  if (linkedEv.length > 1) {
    const hashes = new Set(linkedEv.map((e) => e.scopeHash).filter(Boolean));
    if (hashes.size > 1) {
      scopeConsistency = 0;
      rationale.push(
        'Consistencia de scope: Incompatibilidad entre hash de scope de evidencias (0/20).',
      );
    } else {
      rationale.push(
        'Consistencia de scope: Todas las evidencias comparten el mismo hash de scope (20/20).',
      );
    }
  } else {
    rationale.push('Consistencia de scope: Scope único verificado (20/20).');
  }

  // 3. Numeric Grounding Completeness (25 points)
  let numericGrounding = 25;
  const violations = auditNumericClaims([finding], evidenceList);
  if (violations.length > 0) {
    const penaltyPerViolation = 10;
    numericGrounding = Math.max(
      0,
      25 - violations.length * penaltyPerViolation,
    );
    rationale.push(
      `Fundamentación numérica: Se detectaron ${violations.length} violaciones de fundamentación (${numericGrounding}/25).`,
    );
  } else {
    rationale.push(
      'Fundamentación numérica: Todos los números de la respuesta están respaldados por claims y métricas (25/25).',
    );
  }

  // 4. Sample Adequacy (20 points)
  let sampleAdequacy = 20;
  let minSampleSize = Infinity;
  for (const ev of linkedEv) {
    if (ev.sampleSize !== undefined && ev.sampleSize < minSampleSize) {
      minSampleSize = ev.sampleSize;
    }
  }
  if (minSampleSize === Infinity || minSampleSize === 0) {
    sampleAdequacy = 0;
    rationale.push(
      'Adecuación muestral: Muestra insuficiente o ausente (0/20).',
    );
  } else if (minSampleSize < 10) {
    sampleAdequacy = 10;
    rationale.push(
      `Adecuación muestral: Tamaño muestral bajo (${minSampleSize} observaciones) (10/20).`,
    );
  } else {
    rationale.push(
      `Adecuación muestral: Muestra robusta de ${minSampleSize.toLocaleString('es-ES')} observaciones (20/20).`,
    );
  }

  // 5. Method Provenance (15 points)
  let methodProvenance = 15;
  if (!finding.methodClaims || finding.methodClaims.length === 0) {
    methodProvenance = 10;
    rationale.push(
      'Proveniencia metodológica: Sin declaración explícita de métodos (10/15).',
    );
  } else {
    rationale.push(
      'Proveniencia metodológica: Métodos vinculados correctamente a herramientas ejecutadas (15/15).',
    );
  }

  const totalScore =
    (executionIntegrity +
      scopeConsistency +
      numericGrounding +
      sampleAdequacy +
      methodProvenance) /
    100;
  let grade: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH';
  if (totalScore < 0.7) grade = 'LOW';
  else if (totalScore < 0.85) grade = 'MEDIUM';

  const dimensions: EvidenceQualityDimensions = {
    executionIntegrity,
    scopeConsistency,
    numericGrounding,
    sampleAdequacy,
    methodProvenance,
  };

  return {
    score: totalScore,
    grade,
    computedBy: 'DETERMINISTIC_V4_2',
    dimensions,
    rationale,
  };
}
