import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  ITraceSink,
  AgentStartedPayload,
  AgentCompletedPayload,
  AgentFailedPayload,
  ToolStartedPayload,
  ToolCompletedPayload,
  ToolFailedPayload,
} from './trace-sink.interface';

@Injectable()
export class PrismaTraceSinkService implements ITraceSink {
  constructor(private readonly prisma: PrismaService) {}

  async onAgentStarted(payload: AgentStartedPayload): Promise<void> {
    try {
      await this.prisma.agentRun.upsert({
        where: { localRunId: payload.localRunId },
        create: {
          localRunId: payload.localRunId,
          investigationId: payload.investigationId,
          agentName: payload.agentName,
          iteration: payload.iteration,
          model: payload.modelName,
          executionKind: payload.executionKind || 'LLM',
          status: 'RUNNING',
          startedAt: payload.startedAt,
        },
        update: {
          status: 'RUNNING',
          startedAt: payload.startedAt,
        },
      });
    } catch (err) {
      console.warn('[PrismaTraceSink] Error persisting onAgentStarted:', err);
    }
  }

  async onAgentCompleted(payload: AgentCompletedPayload): Promise<void> {
    try {
      await this.prisma.agentRun.update({
        where: { localRunId: payload.localRunId },
        data: {
          status: 'COMPLETED',
          completedAt: payload.completedAt,
          durationMs: payload.durationMs,
          inputTokens: payload.inputTokens,
          outputTokens: payload.outputTokens,
          estimatedCost: payload.estimatedCost,
        },
      });
    } catch (err) {
      console.warn('[PrismaTraceSink] Error persisting onAgentCompleted:', err);
    }
  }

  async onAgentFailed(payload: AgentFailedPayload): Promise<void> {
    try {
      await this.prisma.agentRun.update({
        where: { localRunId: payload.localRunId },
        data: {
          status: 'FAILED',
          completedAt: payload.completedAt,
          durationMs: payload.durationMs,
          errorMessage: payload.errorMessage,
        },
      });
    } catch (err) {
      console.warn('[PrismaTraceSink] Error persisting onAgentFailed:', err);
    }
  }

  async onToolStarted(payload: ToolStartedPayload): Promise<void> {
    try {
      const agentRun = await this.prisma.agentRun.findUnique({
        where: { localRunId: payload.localAgentRunId },
      });

      if (!agentRun) {
        console.warn(
          `[PrismaTraceSink] AgentRun ${payload.localAgentRunId} not found for ToolExecution ${payload.localExecutionId}`,
        );
        return;
      }

      await this.prisma.toolExecution.upsert({
        where: { localExecutionId: payload.localExecutionId },
        create: {
          localExecutionId: payload.localExecutionId,
          agentRunId: agentRun.id,
          toolName: payload.toolName,
          parametersJson: payload.parameters as any,
          status: 'RUNNING',
          startedAt: payload.startedAt,
        },
        update: {
          status: 'RUNNING',
          startedAt: payload.startedAt,
        },
      });
    } catch (err) {
      console.warn('[PrismaTraceSink] Error persisting onToolStarted:', err);
    }
  }

  async onToolCompleted(payload: ToolCompletedPayload): Promise<void> {
    try {
      await this.prisma.toolExecution.update({
        where: { localExecutionId: payload.localExecutionId },
        data: {
          status: 'COMPLETED',
          completedAt: payload.completedAt,
          durationMs: payload.durationMs,
          resultSummary: payload.resultSummary,
        },
      });
    } catch (err) {
      console.warn('[PrismaTraceSink] Error persisting onToolCompleted:', err);
    }
  }

  async onToolFailed(payload: ToolFailedPayload): Promise<void> {
    try {
      await this.prisma.toolExecution.update({
        where: { localExecutionId: payload.localExecutionId },
        data: {
          status: 'FAILED',
          completedAt: payload.completedAt,
          durationMs: payload.durationMs,
          errorMessage: payload.errorMessage,
        },
      });
    } catch (err) {
      console.warn('[PrismaTraceSink] Error persisting onToolFailed:', err);
    }
  }
}
