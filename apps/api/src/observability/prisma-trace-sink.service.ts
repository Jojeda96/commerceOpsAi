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
      const existing = await this.prisma.agentRun.findFirst({
        where: { localRunId: payload.localRunId },
      });
      if (existing) {
        await this.prisma.agentRun.update({
          where: { id: existing.id },
          data: {
            status: 'RUNNING',
            startedAt: payload.startedAt,
          },
        });
      } else {
        await this.prisma.agentRun.create({
          data: {
            localRunId: payload.localRunId,
            investigationId: payload.investigationId,
            agentName: payload.agentName,
            iteration: payload.iteration,
            model: payload.modelName,
            executionKind: payload.executionKind || 'LLM',
            status: 'RUNNING',
            startedAt: payload.startedAt,
          },
        });
      }
    } catch (err) {
      console.warn('[PrismaTraceSink] Error persisting onAgentStarted:', err);
    }
  }

  async onAgentCompleted(payload: AgentCompletedPayload): Promise<void> {
    try {
      const existing = await this.prisma.agentRun.findFirst({
        where: { localRunId: payload.localRunId },
      });
      if (existing) {
        await this.prisma.agentRun.update({
          where: { id: existing.id },
          data: {
            status: 'COMPLETED',
            completedAt: payload.completedAt,
            durationMs: payload.durationMs,
            inputTokens: payload.inputTokens,
            outputTokens: payload.outputTokens,
            estimatedCost: payload.estimatedCost,
          },
        });
      }
    } catch (err) {
      console.warn('[PrismaTraceSink] Error persisting onAgentCompleted:', err);
    }
  }

  async onAgentFailed(payload: AgentFailedPayload): Promise<void> {
    try {
      const existing = await this.prisma.agentRun.findFirst({
        where: { localRunId: payload.localRunId },
      });
      if (existing) {
        await this.prisma.agentRun.update({
          where: { id: existing.id },
          data: {
            status: 'FAILED',
            completedAt: payload.completedAt,
            durationMs: payload.durationMs,
            errorMessage: payload.errorMessage,
          },
        });
      }
    } catch (err) {
      console.warn('[PrismaTraceSink] Error persisting onAgentFailed:', err);
    }
  }

  async onToolStarted(payload: ToolStartedPayload): Promise<void> {
    try {
      const agentRun = await this.prisma.agentRun.findFirst({
        where: { localRunId: payload.localAgentRunId },
      });

      if (!agentRun) {
        return;
      }

      const existing = await this.prisma.toolExecution.findFirst({
        where: { localExecutionId: payload.localExecutionId },
      });

      if (existing) {
        await this.prisma.toolExecution.update({
          where: { id: existing.id },
          data: {
            status: 'RUNNING',
            startedAt: payload.startedAt,
          },
        });
      } else {
        await this.prisma.toolExecution.create({
          data: {
            localExecutionId: payload.localExecutionId,
            agentRunId: agentRun.id,
            toolName: payload.toolName,
            parametersJson: payload.parameters as any,
            status: 'RUNNING',
            startedAt: payload.startedAt,
          },
        });
      }
    } catch (err) {
      console.warn('[PrismaTraceSink] Error persisting onToolStarted:', err);
    }
  }

  async onToolCompleted(payload: ToolCompletedPayload): Promise<void> {
    try {
      const existing = await this.prisma.toolExecution.findFirst({
        where: { localExecutionId: payload.localExecutionId },
      });
      if (existing) {
        await this.prisma.toolExecution.update({
          where: { id: existing.id },
          data: {
            status: 'COMPLETED',
            completedAt: payload.completedAt,
            durationMs: payload.durationMs,
            resultSummary: payload.resultSummary,
          },
        });
      }
    } catch (err) {
      console.warn('[PrismaTraceSink] Error persisting onToolCompleted:', err);
    }
  }

  async onToolFailed(payload: ToolFailedPayload): Promise<void> {
    try {
      const existing = await this.prisma.toolExecution.findFirst({
        where: { localExecutionId: payload.localExecutionId },
      });
      if (existing) {
        await this.prisma.toolExecution.update({
          where: { id: existing.id },
          data: {
            status: 'FAILED',
            completedAt: payload.completedAt,
            durationMs: payload.durationMs,
            errorMessage: payload.errorMessage,
          },
        });
      }
    } catch (err) {
      console.warn('[PrismaTraceSink] Error persisting onToolFailed:', err);
    }
  }
}
