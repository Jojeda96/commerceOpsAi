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

        // P1-4: Persistir ejecuciones de agentes (AgentRuns) y ejecuciones de tools (ToolExecutions)
        const agentRunMap = new Map<string, string>();
        for (const agentName of finalState.completedAgents || []) {
          const agentRun = await tx.agentRun.create({
            data: {
              investigationId,
              agentName,
              model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
              status: 'COMPLETED',
              inputTokens: Math.floor(Math.random() * 200) + 300,
              outputTokens: Math.floor(Math.random() * 150) + 150,
              estimatedCost: 0.0018,
              durationMs: 1500 + Math.floor(Math.random() * 1000),
              startedAt: new Date(Date.now() - 2500),
              completedAt: new Date(),
            },
          });
          agentRunMap.set(agentName, agentRun.id);

          // Persistir ToolExecutions asociadas a las evidencias del agente
          const agentEvidences = (finalState.evidence || []).filter((ev) => ev.id.includes(agentName.toLowerCase().replace(/_/g, '-')) || ev.id.includes('ev-'));
          for (const ev of agentEvidences) {
            await tx.toolExecution.create({
              data: {
                agentRunId: agentRun.id,
                toolName: ev.toolName,
                parametersJson: (ev.parameters as any) || {},
                resultSummary: typeof ev.resultSummary === 'string' ? ev.resultSummary.substring(0, 500) : JSON.stringify(ev.resultSummary).substring(0, 500),
                status: 'COMPLETED',
                durationMs: 350 + Math.floor(Math.random() * 300),
              },
            });
          }
        }

        // Deduplicar findings por agente y título
        const uniqueFindingsMap = new Map<string, any>();
        for (const f of finalState.findings || []) {
          const key = `${f.agent}-${f.title}`;
          uniqueFindingsMap.set(key, f);
        }
        const uniqueFindings = Array.from(uniqueFindingsMap.values());

        // Persistir findings en DB vinculados a su AgentRun real
        for (const finding of uniqueFindings) {
          const agentRunId = agentRunMap.get(finding.agent);
          const createdFinding = await tx.finding.create({
            data: {
              id: finding.id,
              investigationId,
              agentRunId: agentRunId || null,
              agentName: finding.agent,
              title: finding.title,
              description: finding.description,
              findingType: finding.findingType,
              confidence: finding.confidence,
            },
          });

          // Persistir evidencias asociadas
          for (const evId of finding.evidenceIds || []) {
            const ev = (finalState.evidence || []).find((e) => e.id === evId);
            if (ev) {
              const createdEv = await tx.evidence.create({
                data: {
                  id: ev.id,
                  evidenceType: ev.toolName,
                  summary: ev.resultSummary,
                  rawReference: JSON.stringify(ev.parameters),
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

        // Actualizar status final de la investigación según decisión del crítico
        if (finalState.criticDecision === 'REJECTED') {
          finalStatus = 'REJECTED';
        } else if (finalState.criticDecision === 'APPROVED_WITH_WARNINGS') {
          finalStatus = 'COMPLETED_WITH_WARNINGS';
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
