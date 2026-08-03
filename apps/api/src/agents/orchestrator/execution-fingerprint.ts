import { createHash } from 'crypto';
import { AnalysisScope, AgentName } from '@commerce-ops/shared-types';

export interface ComputeFingerprintInput {
  analysisScope: AnalysisScope;
  selectedAgents: AgentName[];
  objectives?: string[];
  toolParameters?: Record<string, unknown>;
}

export function computeExecutionFingerprint(
  input: ComputeFingerprintInput,
): string {
  const normalized = {
    scopeHash: input.analysisScope.scopeHash,
    agents: [...input.selectedAgents].sort(),
    objectives: input.objectives ? [...input.objectives].sort() : [],
    toolParameters: input.toolParameters || {},
  };

  return createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex')
    .substring(0, 16);
}
