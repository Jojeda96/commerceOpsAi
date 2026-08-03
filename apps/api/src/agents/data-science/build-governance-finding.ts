import {
  Finding,
  ModelGovernanceMetadata,
  Evidence,
} from '@commerce-ops/shared-types';
import { ScenarioUnavailabilityReason } from './scenario-readiness.schema';
import { formatModelIdentity } from './format-model-identity';

export interface BuildGovernanceFindingParams {
  investigationId: string;
  localAgentRunId?: string;
  governance: ModelGovernanceMetadata;
  unavailabilityReason?: ScenarioUnavailabilityReason;
  evidence?: Evidence | Evidence[];
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

  const formattedModel = formatModelIdentity(
    governance.modelName,
    governance.modelVersion,
  );

  let description = `Se verificó la gobernanza del modelo ${formattedModel}. El deployment permanece en ${governance.deploymentStatus} y ${governance.operationallyActionable ? 'está autorizado' : 'no está autorizado'} para uso operativo.`;

  if (unavailabilityReason) {
    let reasonText =
      'No se dispuso de escenarios validados para inferencia predictiva.';
    if (unavailabilityReason === 'SNAPSHOT_TABLE_EMPTY') {
      reasonText = 'El almacén de snapshots de features está vacío.';
    } else if (unavailabilityReason === 'SNAPSHOT_TABLE_MISSING') {
      reasonText =
        'La tabla de snapshots de features no existe en la base de datos.';
    } else if (unavailabilityReason === 'NO_GROUP_MEETS_MINIMUM_SAMPLE') {
      reasonText =
        'Ningún grupo ruta/categoría alcanzó el tamaño de muestra mínimo.';
    } else if (unavailabilityReason === 'NO_ROWS_IN_SCOPE') {
      reasonText =
        'No hay observaciones en el almacén de snapshots dentro del filtro de búsqueda.';
    }

    description += ` ${reasonText} No se ejecutó inferencia y la explicación local no está disponible porque no existe una predicción válida.`;
  }

  const evidenceList = Array.isArray(evidence)
    ? evidence
    : evidence
      ? [evidence]
      : [];

  return {
    id: `finding-ds-gov-${Date.now()}`,
    investigationId,
    localAgentRunId,
    agent: 'DATA_SCIENCE',
    title: `Estado de Gobernanza del Modelo (${governance.deploymentStatus})`,
    description,
    findingType: 'MODEL_GOVERNANCE',
    modelGovernance: governance,
    evidenceIds: evidenceList.map((e) => e.id),
    numericClaims: [],
    methodClaims: [],
    operationalStatus: governance.operationallyActionable
      ? 'ACTIONABLE'
      : 'EXPERIMENTAL_CONTEXT',
    auditStatus: 'APPROVED_WITH_WARNINGS',
    createdAt: new Date().toISOString(),
  };
}
