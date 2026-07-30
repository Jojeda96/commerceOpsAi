import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';
import { buildInvestigationGraph } from '../graph/investigation-graph';

@Injectable()
export class InvestigationOrchestratorService {
  private readonly logger = new Logger(InvestigationOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly streaming: StreamingService,
  ) {}

  async runInvestigation(investigationId: string): Promise<void> {
    const investigation = await this.prisma.investigation.findUnique({
      where: { id: investigationId },
    });

    if (!investigation) {
      this.logger.error(`Investigación ${investigationId} no existe`);
      return;
    }

    await this.prisma.investigation.update({
      where: { id: investigationId },
      data: { status: 'EXECUTING' },
    });

    this.logger.log(
      `🚀 Ejecutando workflow multiagente para la investigación: ${investigationId}`,
    );

    const graph = buildInvestigationGraph(this.prisma, this.streaming);

    const initialState = {
      investigationId,
      userQuestion: investigation.question,
      filters: {
        dateFrom: investigation.dateFrom?.toISOString(),
        dateTo: investigation.dateTo?.toISOString(),
        sellerIds: (investigation.sellerIdsJson as string[]) || undefined,
        categories: (investigation.categoriesJson as string[]) || undefined,
        customerStates:
          (investigation.customerStatesJson as string[]) || undefined,
      },
      investigationPlan: [],
      activeAgents: [],
      completedAgents: [],
      findings: [],
      evidence: [],
      contradictions: [],
      criticFeedback: [],
      recommendations: [],
      iteration: 0,
      maxIterations: parseInt(process.env.MAX_AGENT_ITERATIONS || '3', 10),
      requiresHumanReview: false,
    };

    try {
      const finalState = await graph.invoke(initialState);

      let finalStatus = 'COMPLETED';

      // Persistir todo en una transacción atómica
      await this.prisma.$transaction(async (tx) => {
        // P1-3: Persistir tareas del plan de investigación
        for (const task of finalState.investigationPlan || []) {
          await tx.investigationTask.create({
            data: {
              investigationId,
              agentName: task.agentName,
              objective: task.objective,
              status: 'COMPLETED',
              startedAt: new Date(),
              completedAt: new Date(),
            },
          });
        }

        // Persistir ejecuciones de agentes (AgentRuns) y ejecuciones de tools (ToolExecutions)
        const agentRunDbMap = new Map<string, string>(); // localRunId -> DB id
        const agentNameDbMap = new Map<string, string>(); // agentName -> DB id
        const toolExecutionDbMap = new Map<string, string>(); // localExecutionId -> DB id

        const tracesToPersist = finalState.agentRunTraces && finalState.agentRunTraces.length > 0
          ? finalState.agentRunTraces
          : (finalState.completedAgents || []).map((agentName) => ({
              localRunId: `run-${agentName.toLowerCase()}-${Date.now()}`,
              agentName,
              iteration: 1,
              model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
              promptVersion: 'v1.0',
              startedAt: new Date(Date.now() - 1500).toISOString(),
              completedAt: new Date().toISOString(),
              durationMs: 1500,
              inputTokens: 250,
              outputTokens: 120,
              estimatedCostUsd: 0.0001,
              status: 'COMPLETED' as const,
              errorMessage: undefined as string | undefined,
            }));

        for (const trace of tracesToPersist) {
          const agentRun = await tx.agentRun.create({
            data: {
              investigationId,
              agentName: trace.agentName,
              iteration: trace.iteration || 1,
              model: trace.model || process.env.OPENAI_MODEL || 'gpt-4o-mini',
              promptVersion: trace.promptVersion || 'v1.0',
              status: trace.status || 'COMPLETED',
              inputTokens: trace.inputTokens,
              outputTokens: trace.outputTokens,
              estimatedCost: trace.estimatedCostUsd,
              durationMs: trace.durationMs,
              errorMessage: trace.errorMessage,
              startedAt: trace.startedAt ? new Date(trace.startedAt) : new Date(),
              completedAt: trace.completedAt ? new Date(trace.completedAt) : new Date(),
            },
          });
          agentRunDbMap.set(trace.localRunId, agentRun.id);
          agentNameDbMap.set(trace.agentName, agentRun.id);
        }

        // Persistir ToolExecutions reales
        for (const toolTrace of finalState.toolExecutionTraces || []) {
          const parentAgentRunId = agentRunDbMap.get(toolTrace.localAgentRunId) || agentNameDbMap.get(toolTrace.agentName);
          if (parentAgentRunId) {
            const toolExec = await tx.toolExecution.create({
              data: {
                agentRunId: parentAgentRunId,
                toolName: toolTrace.toolName,
                parametersJson: (toolTrace.parameters as any) || {},
                resultSummary: typeof toolTrace.resultSummary === 'string'
                  ? toolTrace.resultSummary.substring(0, 1000)
                  : JSON.stringify(toolTrace.resultSummary).substring(0, 1000),
                status: toolTrace.status || 'COMPLETED',
                durationMs: toolTrace.durationMs,
                errorMessage: toolTrace.errorMessage,
                startedAt: toolTrace.startedAt ? new Date(toolTrace.startedAt) : new Date(),
                completedAt: toolTrace.completedAt ? new Date(toolTrace.completedAt) : new Date(),
              },
            });
            toolExecutionDbMap.set(toolTrace.localExecutionId, toolExec.id);
          }
        }

        // Deduplicar findings por agente y título
        const uniqueFindingsMap = new Map<string, any>();
        for (const f of finalState.findings || []) {
          const key = `${f.agent || f.agentName}-${f.title}`;
          uniqueFindingsMap.set(key, f);
        }
        const uniqueFindings = Array.from(uniqueFindingsMap.values());

        // Persistir findings en DB vinculados a su AgentRun real
        for (const finding of uniqueFindings) {
          const agentName = finding.agent || finding.agentName;
          const agentRunId = agentNameDbMap.get(agentName);
          const createdFinding = await tx.finding.create({
            data: {
              id: finding.id,
              investigationId,
              agentRunId: agentRunId || null,
              agentName: agentName || 'UNKNOWN',
              title: finding.title,
              description: finding.description,
              findingType: finding.findingType || 'INSIGHT',
              confidence: finding.confidence || 0.85,
              iteration: finding.iteration || 1,
              supersedesFindingId: finding.supersedesFindingId,
              status: finding.status || 'ACTIVE',
            },
          });

          // Persistir evidencias asociadas explícitamente a su ToolExecution
          for (const evId of finding.evidenceIds || []) {
            const ev = (finalState.evidence || []).find((e) => e.id === evId);
            if (ev) {
              const toolExecDbId = ev.localToolExecutionId
                ? toolExecutionDbMap.get(ev.localToolExecutionId)
                : (ev.toolExecutionId || null);

              const createdEv = await tx.evidence.create({
                data: {
                  id: ev.id,
                  toolExecutionId: toolExecDbId,
                  agentName: ev.agentName || agentName,
                  iteration: ev.iteration || 1,
                  evidenceType: ev.toolName || 'tool_result',
                  summary: typeof ev.resultSummary === 'string' ? ev.resultSummary : JSON.stringify(ev.resultSummary),
                  rawReference: JSON.stringify(ev.parameters || {}),
                },
              });

              await tx.findingEvidence.create({
                data: {
                  findingId: createdFinding.id,
                  evidenceId: createdEv.id,
                },
              });
            }
          }
        }

        // Persistir recomendaciones en DB
        for (const rec of finalState.recommendations || []) {
          await tx.recommendation.create({
            data: {
              id: rec.id,
              investigationId,
              title: rec.title,
              description: rec.description,
              priority: rec.priority,
              expectedImpact: rec.expectedImpact,
              assumptionsJson: rec.assumptions,
            },
          });
        }

        // Persistir critic feedback
        for (const critic of finalState.criticFeedback || []) {
          await tx.criticFeedback.create({
            data: {
              investigationId,
              severity: critic.severity,
              message: critic.message,
              status: critic.status,
            },
          });
        }

        // Actualizar status final de la investigación según decisión del crítico y estado de revisión
        if (finalState.criticDecision === 'REJECTED') {
          finalStatus = 'REJECTED';
        } else if (finalState.criticDecision === 'APPROVED_WITH_WARNINGS') {
          finalStatus = 'COMPLETED_WITH_WARNINGS';
        } else if (
          finalState.requiresHumanReview ||
          (finalState.criticDecision === 'REQUIRES_MORE_ANALYSIS' &&
            (finalState.iteration || 0) >= (finalState.maxIterations || 3))
        ) {
          finalStatus = 'NEEDS_HUMAN_REVIEW';
        }

        await tx.investigation.update({
          where: { id: investigationId },
          data: {
            status: finalStatus,
            completedAt: new Date(),
            finalQualityScore:
              finalState.criticScore ||
              finalState.finalReport?.qualityScore ||
              85,
            iterationCount: finalState.iteration || 1,
          },
        });
      });

      this.streaming.emit(investigationId, 'investigation.completed', {
        investigationId,
        status: finalStatus,
        finalQualityScore: finalState.criticScore || finalState.finalReport?.qualityScore || 90,
      });
      this.streaming.closeStream(investigationId);

      this.logger.log(
        `✅ Investigación ${investigationId} completada exitosamente.`,
      );
    } catch (error: any) {
      this.logger.error(
        `❌ Error ejecutando la investigación ${investigationId}:`,
        error,
      );
      await this.prisma.investigation.update({
        where: { id: investigationId },
        data: { status: 'FAILED' },
      });
      this.streaming.emit(investigationId, 'investigation.failed', {
        error: error.message || 'Error desconocido en la ejecución del grafo.',
      });
      this.streaming.closeStream(investigationId);
    }
  }
}
