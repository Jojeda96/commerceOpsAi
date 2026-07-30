import { AgentName } from '@commerce-ops/shared-types';

export interface AgentStartedPayload {
  localRunId: string;
  investigationId: string;
  agentName: AgentName;
  iteration: number;
  modelName?: string;
  executionKind?: 'LLM' | 'DETERMINISTIC';
  startedAt: Date;
}

export interface AgentCompletedPayload {
  localRunId: string;
  completedAt: Date;
  durationMs: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCost?: number;
}

export interface AgentFailedPayload {
  localRunId: string;
  completedAt: Date;
  durationMs: number;
  errorMessage: string;
}

export interface ToolStartedPayload {
  localExecutionId: string;
  localAgentRunId: string;
  agentName: AgentName;
  iteration: number;
  toolName: string;
  parameters: unknown;
  startedAt: Date;
}

export interface ToolCompletedPayload {
  localExecutionId: string;
  completedAt: Date;
  durationMs: number;
  resultSummary?: string;
}

export interface ToolFailedPayload {
  localExecutionId: string;
  completedAt: Date;
  durationMs: number;
  errorMessage: string;
}

export interface ITraceSink {
  onAgentStarted(payload: AgentStartedPayload): Promise<void>;
  onAgentCompleted(payload: AgentCompletedPayload): Promise<void>;
  onAgentFailed(payload: AgentFailedPayload): Promise<void>;
  onToolStarted(payload: ToolStartedPayload): Promise<void>;
  onToolCompleted(payload: ToolCompletedPayload): Promise<void>;
  onToolFailed(payload: ToolFailedPayload): Promise<void>;
}
