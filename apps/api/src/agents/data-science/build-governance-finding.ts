import {
  Finding,
  ModelGovernanceMetadata,
  Evidence,
} from '@commerce-ops/shared-types';
import { ScenarioUnavailabilityReason } from './scenario-readiness.schema';

export interface BuildGovernanceFindingParams {
  investigationId: string;
  localAgentRunId?: string;
  governance: ModelGovernanceMetadata;
  unavailabilityReason?: ScenarioUnavailabilityReason;
  evidence?: Evidence;
}

export function buildGovernanceFinding(
  params: BuildGovernanceFindingParams,
): Finding {
  const {
    investigationId,
    localAgentRunId,
    governance,
    unavailabilityReason,
    evidence,
  } = params;

  let description = `El modelo de machine learning ${governance.modelName} (versión ${governance.modelVersion}) se encuentra en estado de despliegue ${governance.deploymentStatus}. Accionabilidad operacional: ${governance.operationallyActionable ? 'SÍ' : 'NO'}.`;

  if (unavailabilityReason) {
    let reasonText =
      'No se dispuso de escenarios validados para inferencia predictiva.';
    if (unavailabilityReason === 'SNAPSHOT_TABLE_EMPTY') {
      reasonText =
        'El almacén de snapshots de features está vacío. No se pueden construir escenarios de inferencia.';
    } else if (unavailabilityReason === 'SNAPSHOT_TABLE_MISSING') {
      reasonText =
        'La tabla de snapshots de features no existe en la base de datos.';
    } else if (unavailabilityReason === 'NO_GROUP_MEETS_MINIMUM_SAMPLE') {
      reasonText =
        'Ningún grupo ruta/categoría alcanzó el tamaño de muestra mínimo (10 observaciones).';
    } else if (unavailabilityReason === 'NO_ROWS_IN_SCOPE') {
      reasonText =
        'No hay observaciones en el almacén de snapshots dentro del filtro de búsqueda.';
    }

    description += ` Predicción no disponible: ${reasonText} No se ejecutó inferencia predictiva ni explicación local SHAP.`;
  }

  return {
    id: `finding-ds-gov-${Date.now()}`,
    investigationId,
    localAgentRunId,
    agent: 'DATA_SCIENCE',
    title: `Gobernanza del Modelo — ${governance.modelName}`,
    description,
    findingType: 'MODEL_GOVERNANCE',
    modelGovernance: governance,
    evidenceIds: evidence ? [evidence.id] : [],
    numericClaims: [],
    methodClaims: [],
    operationalStatus: governance.operationallyActionable
      ? 'ACTIONABLE'
      : 'EXPERIMENTAL_CONTEXT',
    auditStatus: 'APPROVED_WITH_WARNINGS',
    createdAt: new Date().toISOString(),
  };
}
