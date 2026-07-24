import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';
import { buildInvestigationGraph } from '../graph/investigation-graph';

@Injectable()
export class InvestigationOrchestratorService {
  private readonly logger = new Logger(InvestigationOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly streaming: StreamingService
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

    this.logger.log(`🚀 Ejecutando workflow multiagente para la investigación: ${investigationId}`);

    const graph = buildInvestigationGraph(this.prisma, this.streaming);

    const initialState = {
      investigationId,
      userQuestion: investigation.question,
      filters: {
        dateFrom: investigation.dateFrom?.toISOString(),
        dateTo: investigation.dateTo?.toISOString(),
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
      maxIterations: 3,
      requiresHumanReview: false,
    };

    try {
      const finalState = await graph.invoke(initialState);

      // Persistir findings en DB
      for (const finding of finalState.findings || []) {
        const createdFinding = await this.prisma.finding.create({
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
            const createdEv = await this.prisma.evidence.create({
              data: {
                id: ev.id,
                evidenceType: ev.toolName,
                summary: ev.resultSummary,
                rawReference: JSON.stringify(ev.parameters),
              },
            });

            await this.prisma.findingEvidence.create({
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
        await this.prisma.recommendation.create({
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
        await this.prisma.criticFeedback.create({
          data: {
            investigationId,
            severity: critic.severity,
            message: critic.message,
            status: critic.status,
          },
        });
      }

      // Actualizar status final de la investigación
      await this.prisma.investigation.update({
        where: { id: investigationId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          finalQualityScore: finalState.finalReport?.qualityScore || 90,
          iterationCount: finalState.iteration || 1,
        },
      });

      this.streaming.emit(investigationId, 'investigation.completed', {
        investigationId,
        status: 'COMPLETED',
        finalQualityScore: finalState.finalReport?.qualityScore || 90,
      });

      this.logger.log(`✅ Investigación ${investigationId} completada exitosamente.`);
    } catch (error: any) {
      this.logger.error(`❌ Error ejecutando la investigación ${investigationId}:`, error);
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
