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

  async executeInvestigation(investigationId: string): Promise<void> {
    this.logger.log(`Iniciando investigación ${investigationId}...`);

    const investigation = await this.prisma.investigation.findUnique({
      where: { id: investigationId },
    });

    if (!investigation) {
      throw new Error(`Investigación ${investigationId} no encontrada.`);
    }

    if (
      investigation.status === 'RUNNING' ||
      investigation.status === 'COMPLETED'
    ) {
      throw new Error(
        `Investigación ${investigationId} ya está en estado ${investigation.status}. Rechazando doble ejecución.`,
      );
    }

    await this.prisma.investigation.update({
      where: { id: investigationId },
      data: { status: 'RUNNING' },
    });

    const graph = buildInvestigationGraph(this.prisma, this.streaming);

    const initialState = {
      investigationId,
      userQuestion: investigation.question,
      filters: {
        sellerIds: (investigation.sellerIdsJson as string[]) || undefined,
        categories: (investigation.categoriesJson as string[]) || undefined,
        customerStates:
          (investigation.customerStatesJson as string[]) || undefined,
        dateFrom: investigation.dateFrom
          ? investigation.dateFrom.toISOString()
          : undefined,
        dateTo: investigation.dateTo
          ? investigation.dateTo.toISOString()
          : undefined,
      },
      completedAgents: [],
      activeAgents: [],
      agentRunTraces: [],
      toolExecutionTraces: [],
      findings: [],
      evidence: [],
      criticFeedback: [],
      recommendations: [],
      modelPredictions: [],
      iteration: 0,
      maxIterations: 3,
      criticDecision: 'PENDING',
      criticScore: 0,
    };

    try {
      this.streaming.emit(investigationId, 'investigation.started', {
        investigationId,
        question: investigation.question,
      });

      const finalState = await graph.invoke(initialState);
      let finalStatus = 'COMPLETED';

      // Transacción unificada de persistencia en PostgreSQL
      await this.prisma.$transaction(async (tx) => {
        const agentRunDbMap = new Map<string, string>(); // localRunId -> DB id
        const toolExecutionDbMap = new Map<string, string>(); // localExecutionId -> DB id

        const tracesToPersist = finalState.agentRunTraces ?? [];

        for (const trace of tracesToPersist) {
          const existingRun = await tx.agentRun.findFirst({
            where: { localRunId: trace.localRunId },
          });

          let agentRun;
          if (existingRun) {
            agentRun = await tx.agentRun.update({
              where: { id: existingRun.id },
              data: {
                status: trace.status || 'COMPLETED',
                completedAt: trace.completedAt
                  ? new Date(trace.completedAt)
                  : new Date(),
                durationMs: trace.durationMs,
                inputTokens: trace.inputTokens,
                outputTokens: trace.outputTokens,
                estimatedCost: trace.estimatedCostUsd,
                errorMessage: trace.errorMessage,
              },
            });
          } else {
            agentRun = await tx.agentRun.create({
              data: {
                localRunId: trace.localRunId,
                investigationId,
                agentName: trace.agentName,
                iteration: trace.iteration || 1,
                model: trace.model || undefined,
                executionKind: trace.model ? 'LLM' : 'DETERMINISTIC',
                promptVersion: trace.promptVersion || 'v1.0',
                status: trace.status || 'COMPLETED',
                inputTokens: trace.inputTokens,
                outputTokens: trace.outputTokens,
                estimatedCost: trace.estimatedCostUsd,
                durationMs: trace.durationMs,
                errorMessage: trace.errorMessage,
                startedAt: trace.startedAt
                  ? new Date(trace.startedAt)
                  : new Date(),
                completedAt: trace.completedAt
                  ? new Date(trace.completedAt)
                  : new Date(),
              },
            });
          }
          agentRunDbMap.set(trace.localRunId, agentRun.id);
        }

        // Persistir ToolExecutions
        for (const toolTrace of finalState.toolExecutionTraces || []) {
          let parentAgentRunId = agentRunDbMap.get(toolTrace.localAgentRunId);
          if (!parentAgentRunId) {
            const dbRun = await tx.agentRun.findFirst({
              where: { localRunId: toolTrace.localAgentRunId },
            });
            if (dbRun) {
              parentAgentRunId = dbRun.id;
            }
          }

          if (!parentAgentRunId) {
            this.logger.warn(
              `Tool execution ${toolTrace.toolName} (${toolTrace.localExecutionId}) no tiene AgentRun trace correspondiente (${toolTrace.localAgentRunId}).`,
            );
            continue;
          }

          const existingToolExec = await tx.toolExecution.findFirst({
            where: { localExecutionId: toolTrace.localExecutionId },
          });

          let toolExec;
          if (existingToolExec) {
            toolExec = await tx.toolExecution.update({
              where: { id: existingToolExec.id },
              data: {
                status: toolTrace.status || 'COMPLETED',
                durationMs: toolTrace.durationMs,
                errorMessage: toolTrace.errorMessage,
                completedAt: toolTrace.completedAt
                  ? new Date(toolTrace.completedAt)
                  : new Date(),
                resultSummary:
                  typeof toolTrace.resultSummary === 'string'
                    ? toolTrace.resultSummary.substring(0, 1000)
                    : JSON.stringify(toolTrace.resultSummary).substring(
                        0,
                        1000,
                      ),
              },
            });
          } else {
            toolExec = await tx.toolExecution.create({
              data: {
                localExecutionId: toolTrace.localExecutionId,
                agentRunId: parentAgentRunId,
                toolName: toolTrace.toolName,
                parametersJson: (toolTrace.parameters as any) || {},
                resultSummary:
                  typeof toolTrace.resultSummary === 'string'
                    ? toolTrace.resultSummary.substring(0, 1000)
                    : JSON.stringify(toolTrace.resultSummary).substring(
                        0,
                        1000,
                      ),
                status: toolTrace.status || 'COMPLETED',
                durationMs: toolTrace.durationMs,
                errorMessage: toolTrace.errorMessage,
                startedAt: toolTrace.startedAt
                  ? new Date(toolTrace.startedAt)
                  : new Date(),
                completedAt: toolTrace.completedAt
                  ? new Date(toolTrace.completedAt)
                  : new Date(),
              },
            });
          }
          toolExecutionDbMap.set(toolTrace.localExecutionId, toolExec.id);
        }

        // Deduplicar findings por agente y título
        const uniqueFindingsMap = new Map<string, any>();
        for (const f of finalState.findings || []) {
          const key = `${f.agent || f.agentName}-${f.title}`;
          uniqueFindingsMap.set(key, f);
        }
        const uniqueFindings = Array.from(uniqueFindingsMap.values());

        // Persistir findings en DB
        for (const finding of uniqueFindings) {
          const agentRunId = finding.localAgentRunId
            ? agentRunDbMap.get(finding.localAgentRunId)
            : null;

          const createdFinding = await tx.finding.create({
            data: {
              id: finding.id,
              investigationId,
              agentRunId: agentRunId || null,
              agentName: finding.agent || finding.agentName || 'UNKNOWN',
              findingKey:
                finding.findingKey ||
                `${finding.agent || finding.agentName}:${finding.title}`,
              title: finding.title,
              description: finding.description,
              findingType: finding.findingType || 'INSIGHT',
              confidence:
                finding.confidence !== undefined ? finding.confidence : null,
              confidenceKind:
                finding.confidenceDetails?.kind || 'EVIDENCE_QUALITY',
              confidenceRationale:
                finding.confidenceDetails?.rationaleCodes || undefined,
              auditStatus:
                finding.auditStatus ||
                (finalState.criticDecision === 'REJECTED'
                  ? 'REJECTED'
                  : 'APPROVED'),
              iteration: finding.iteration || finalState.iteration || 1,
              supersedesFindingId: finding.supersedesFindingId,
              status: finding.status || 'ACTIVE',
              operationalStatus: finding.operationalStatus || 'ACTIONABLE',
              modelGovernanceJson: finding.modelGovernance
                ? finding.modelGovernance
                : undefined,
              numericClaimsJson: finding.numericClaims
                ? finding.numericClaims
                : undefined,
              methodClaimsJson: finding.methodClaims
                ? finding.methodClaims
                : undefined,
              auditRationaleJson: finding.auditMessages
                ? finding.auditMessages
                : undefined,
              evidenceQualityJson: finding.evidenceQuality
                ? finding.evidenceQuality
                : undefined,
            },
          });

          // Persistir evidencias asociadas
          for (const evId of finding.evidenceIds || []) {
            const ev = (finalState.evidence || []).find(
              (e: any) => e.id === evId,
            );
            if (ev) {
              const toolExecDbId = ev.localToolExecutionId
                ? toolExecutionDbMap.get(ev.localToolExecutionId)
                : ev.toolExecutionId || null;

              const createdEv = await tx.evidence.create({
                data: {
                  id: ev.id,
                  toolExecutionId: toolExecDbId,
                  agentName: ev.agentName || finding.agent,
                  iteration: ev.iteration || finalState.iteration || 1,
                  evidenceType: ev.toolName || 'tool_result',
                  summary:
                    typeof ev.resultSummary === 'string'
                      ? ev.resultSummary
                      : JSON.stringify(ev.resultSummary),
                  status: (ev as any).status || 'AVAILABLE',
                  scopeHash:
                    (ev as any).scopeHash ||
                    finalState.analysisScope?.scopeHash,
                  appliedScopeJson: (ev as any).appliedScope
                    ? (ev as any).appliedScope
                    : (finalState.analysisScope as any),
                  reasonCode: (ev as any).reasonCode,
                  rawReference: JSON.stringify(ev.parameters || {}),
                  metricsJson: ev.metrics ? (ev.metrics as any) : undefined,
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

        // Persistir predicciones ML
        for (const mp of finalState.modelPredictions || []) {
          await tx.modelPrediction.create({
            data: {
              investigationId,
              findingId: mp.findingId || null,
              scenarioId: mp.scenarioId,
              modelName: mp.modelName || 'xgboost',
              modelVersion: mp.modelVersion || 'delivery-risk-v3.0.0',
              deploymentStatus:
                mp.deploymentStatus || 'EXPERIMENTAL_NOT_APPROVED',
              probability: mp.probability,
              threshold: mp.threshold,
              predictedDelayed: mp.predictedDelayed,
              riskLevel: mp.riskLevel || 'LOW',
              operationallyActionable: Boolean(mp.operationallyActionable),
              featuresJson: mp.featuresJson,
              explanationJson: mp.explanationJson,
            },
          });
        }

        // Persistir recomendaciones
        for (const rec of finalState.recommendations || []) {
          await tx.recommendation.create({
            data: {
              id: rec.id,
              investigationId,
              title: rec.title,
              description: rec.description,
              priority: rec.priority,
              kind: rec.kind || 'HYPOTHESIS_TO_TEST',
              evidenceBasisJson: rec.evidenceBasis
                ? (rec.evidenceBasis as any)
                : undefined,
              validationRequirementsJson: rec.validationRequirements
                ? (rec.validationRequirements as any)
                : undefined,
              expectedImpact: rec.expectedImpact,
              expectedImpactClaimsJson: rec.expectedImpactClaims
                ? (rec.expectedImpactClaims as any)
                : undefined,
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
            resolvedScopeJson: (finalState.analysisScope as any) || undefined,
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
        finalQualityScore:
          finalState.criticScore || finalState.finalReport?.qualityScore || 90,
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
