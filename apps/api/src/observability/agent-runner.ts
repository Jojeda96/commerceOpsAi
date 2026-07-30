import {
  AgentName,
  AgentRunTrace,
  ToolExecutionTrace,
} from '@commerce-ops/shared-types';
import { calculateEstimatedCostUsd } from './model-pricing';

export class AgentRunError extends Error {
  constructor(
    public readonly originalError: any,
    public readonly trace: AgentRunTrace,
  ) {
    super(originalError?.message || String(originalError));
    this.name = 'AgentRunError';
  }
}

export class ToolExecutionError extends Error {
  constructor(
    public readonly originalError: any,
    public readonly trace: ToolExecutionTrace,
  ) {
    super(originalError?.message || String(originalError));
    this.name = 'ToolExecutionError';
  }
}

export interface RunAgentOptions<T> {
  agentName: AgentName;
  iteration: number;
  modelName?: string;
  promptVersion?: string;
  execute: () => Promise<{
    result: T;
    inputTokens?: number;
    outputTokens?: number;
  }>;
}

export async function runAgentWithTrace<T>(
  options: RunAgentOptions<T>,
): Promise<{
  result: T;
  trace: AgentRunTrace;
}> {
  const localRunId = `run-${options.agentName.toLowerCase()}-${options.iteration}-${Date.now()}`;
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const modelName =
    options.modelName || process.env.OPENAI_MODEL || 'gpt-4o-mini';

  try {
    const { result, inputTokens, outputTokens } = await options.execute();
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    const estimatedCostUsd = calculateEstimatedCostUsd(
      modelName,
      inputTokens,
      outputTokens,
    );

    const trace: AgentRunTrace = {
      localRunId,
      agentName: options.agentName,
      iteration: options.iteration,
      model: modelName,
      promptVersion: options.promptVersion || 'v1.0',
      startedAt,
      completedAt: new Date(endTime).toISOString(),
      durationMs,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      status: 'COMPLETED',
    };

    return { result, trace };
  } catch (error: any) {
    const endTime = Date.now();
    const durationMs = endTime - startTime;

    const trace: AgentRunTrace = {
      localRunId,
      agentName: options.agentName,
      iteration: options.iteration,
      model: modelName,
      promptVersion: options.promptVersion || 'v1.0',
      startedAt,
      completedAt: new Date(endTime).toISOString(),
      durationMs,
      status: 'FAILED',
      errorMessage: error?.message || String(error),
    };

    throw new AgentRunError(error, trace);
  }
}

export interface ExecuteToolOptions<P, R> {
  localAgentRunId: string;
  agentName: AgentName;
  iteration: number;
  toolName: string;
  parameters: P;
  execute: () => Promise<R>;
}

export async function executeToolWithTrace<P, R>(
  options: ExecuteToolOptions<P, R>,
): Promise<{
  result: R;
  trace: ToolExecutionTrace;
}> {
  const localExecutionId = `tool-${options.toolName.toLowerCase()}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  try {
    const result = await options.execute();
    const endTime = Date.now();
    const durationMs = endTime - startTime;

    const trace: ToolExecutionTrace = {
      localExecutionId,
      localAgentRunId: options.localAgentRunId,
      agentName: options.agentName,
      iteration: options.iteration,
      toolName: options.toolName,
      parameters: options.parameters,
      resultSummary:
        typeof result === 'string' ? result : JSON.stringify(result),
      startedAt,
      completedAt: new Date(endTime).toISOString(),
      durationMs,
      status: 'COMPLETED',
    };

    return { result, trace };
  } catch (error: any) {
    const endTime = Date.now();
    const durationMs = endTime - startTime;

    const trace: ToolExecutionTrace = {
      localExecutionId,
      localAgentRunId: options.localAgentRunId,
      agentName: options.agentName,
      iteration: options.iteration,
      toolName: options.toolName,
      parameters: options.parameters,
      startedAt,
      completedAt: new Date(endTime).toISOString(),
      durationMs,
      status: 'FAILED',
      errorMessage: error?.message || String(error),
    };

    throw new ToolExecutionError(error, trace);
  }
}
