import {
  AgentName,
  AgentRunTrace,
  ToolExecutionTrace,
} from '@commerce-ops/shared-types';
import { calculateEstimatedCostUsd } from './model-pricing';
import { getGlobalTraceSink } from './trace-context';

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

export interface RunAgentContext {
  localRunId: string;
}

export interface RunAgentOptions<T> {
  agentName: AgentName;
  iteration: number;
  investigationId?: string;
  modelName?: string;
  executionKind?: 'LLM' | 'DETERMINISTIC';
  promptVersion?: string;
  execute: (context: RunAgentContext) => Promise<{
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
  const startDate = new Date();
  const startedAt = startDate.toISOString();
  const startTime = startDate.getTime();
  const modelName =
    options.modelName || process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const sink = getGlobalTraceSink();
  if (sink && options.investigationId) {
    await sink.onAgentStarted({
      localRunId,
      investigationId: options.investigationId,
      agentName: options.agentName,
      iteration: options.iteration,
      modelName:
        options.executionKind === 'DETERMINISTIC' ? undefined : modelName,
      executionKind: options.executionKind || 'LLM',
      startedAt: startDate,
    });
  }

  try {
    const { result, inputTokens, outputTokens } = await options.execute({
      localRunId,
    });
    const endDate = new Date();
    const durationMs = endDate.getTime() - startTime;
    const estimatedCostUsd = calculateEstimatedCostUsd(
      modelName,
      inputTokens,
      outputTokens,
    );

    const trace: AgentRunTrace = {
      localRunId,
      agentName: options.agentName,
      iteration: options.iteration,
      model: options.executionKind === 'DETERMINISTIC' ? undefined : modelName,
      promptVersion: options.promptVersion || 'v1.0',
      startedAt,
      completedAt: endDate.toISOString(),
      durationMs,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      status: 'COMPLETED',
    };

    if (sink) {
      await sink.onAgentCompleted({
        localRunId,
        completedAt: endDate,
        durationMs,
        inputTokens,
        outputTokens,
        estimatedCost: estimatedCostUsd,
      });
    }

    return { result, trace };
  } catch (error: any) {
    const endDate = new Date();
    const durationMs = endDate.getTime() - startTime;

    const trace: AgentRunTrace = {
      localRunId,
      agentName: options.agentName,
      iteration: options.iteration,
      model: options.executionKind === 'DETERMINISTIC' ? undefined : modelName,
      promptVersion: options.promptVersion || 'v1.0',
      startedAt,
      completedAt: endDate.toISOString(),
      durationMs,
      status: 'FAILED',
      errorMessage: error?.message || String(error),
    };

    if (sink) {
      await sink.onAgentFailed({
        localRunId,
        completedAt: endDate,
        durationMs,
        errorMessage: error?.message || String(error),
      });
    }

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
  const startDate = new Date();
  const startedAt = startDate.toISOString();
  const startTime = startDate.getTime();

  const sink = getGlobalTraceSink();
  if (sink) {
    await sink.onToolStarted({
      localExecutionId,
      localAgentRunId: options.localAgentRunId,
      agentName: options.agentName,
      iteration: options.iteration,
      toolName: options.toolName,
      parameters: options.parameters,
      startedAt: startDate,
    });
  }

  try {
    const result = await options.execute();
    const endDate = new Date();
    const durationMs = endDate.getTime() - startTime;
    const resultSummary =
      typeof result === 'string' ? result : JSON.stringify(result);

    const trace: ToolExecutionTrace = {
      localExecutionId,
      localAgentRunId: options.localAgentRunId,
      agentName: options.agentName,
      iteration: options.iteration,
      toolName: options.toolName,
      parameters: options.parameters,
      resultSummary,
      startedAt,
      completedAt: endDate.toISOString(),
      durationMs,
      status: 'COMPLETED',
    };

    if (sink) {
      await sink.onToolCompleted({
        localExecutionId,
        completedAt: endDate,
        durationMs,
        resultSummary,
      });
    }

    return { result, trace };
  } catch (error: any) {
    const endDate = new Date();
    const durationMs = endDate.getTime() - startTime;

    const trace: ToolExecutionTrace = {
      localExecutionId,
      localAgentRunId: options.localAgentRunId,
      agentName: options.agentName,
      iteration: options.iteration,
      toolName: options.toolName,
      parameters: options.parameters,
      startedAt,
      completedAt: endDate.toISOString(),
      durationMs,
      status: 'FAILED',
      errorMessage: error?.message || String(error),
    };

    if (sink) {
      await sink.onToolFailed({
        localExecutionId,
        completedAt: endDate,
        durationMs,
        errorMessage: error?.message || String(error),
      });
    }

    throw new ToolExecutionError(error, trace);
  }
}
