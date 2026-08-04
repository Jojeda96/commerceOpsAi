import { Evidence, AnalysisScope, AgentName } from '@commerce-ops/shared-types';

export interface CreateEvidenceParams {
  id: string;
  localAgentRunId?: string;
  localToolExecutionId?: string;
  agentName: AgentName;
  iteration: number;
  toolName: string;
  scopeHash: string;
  appliedScope: AnalysisScope;
  parameters: Record<string, unknown>;
  rawResultString: string;
}

export function createEvidenceFromToolEnvelope(
  params: CreateEvidenceParams,
): Evidence {
  const {
    id,
    localAgentRunId,
    localToolExecutionId,
    agentName,
    iteration,
    toolName,
    scopeHash,
    appliedScope,
    parameters,
    rawResultString,
  } = params;

  let envelope: any = {};
  try {
    envelope = JSON.parse(rawResultString);
  } catch (e) {
    envelope = { status: 'AVAILABLE', data: rawResultString };
  }

  const status = envelope.status || 'AVAILABLE';
  const reasonCode = envelope.reasonCode;
  const rowCount = envelope.rowCount ?? 0;
  const sampleSize = envelope.sampleSize ?? 0;
  const metrics = envelope.metrics || [];

  return {
    id,
    toolExecutionId: localToolExecutionId,
    localAgentRunId,
    localToolExecutionId,
    sourceType: 'TOOL_EXECUTION',
    agentName,
    iteration,
    toolName,
    scopeHash,
    appliedScope,
    status,
    reasonCode,
    parameters,
    resultSummary: rawResultString,
    rowCount,
    sampleSize,
    metrics,
    generatedAt: new Date().toISOString(),
  };
}
