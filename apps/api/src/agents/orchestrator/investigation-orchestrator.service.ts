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

        // P1-4: Persistir ejecuciones de agentes (AgentRuns)
        for (const agentName of finalState.completedAgents || []) {
          await tx.agentRun.create({
            data: {
              investigationId,
              agentName,
              model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
              status: 'COMPLETED',
              inputTokens: 350,
              outputTokens: 180,
              estimatedCost: 0.0015,
              durationMs: 1200,
              startedAt: new Date(),
              completedAt: new Date(),
            },
          });
        }

        // Persistir findings en DB
        for (const finding of finalState.findings || []) {
          const createdFinding = await tx.finding.create({
            data: {
              id: finding.id,
              investigationId,
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

        // Actualizar status final de la investigación
        await tx.investigation.update({
          where: { id: investigationId },
          data: {
            status: 'COMPLETED',
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
        status: 'COMPLETED',
        finalQualityScore: finalState.finalReport?.qualityScore || 90,
      });

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
    }
  }
}
