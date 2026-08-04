import { ChatOpenAI } from '@langchain/openai';
import { CriticDecision, AgentName, Finding } from '@commerce-ops/shared-types';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { StreamingService } from '../../streaming/streaming.service';
import { runAgentWithTrace } from '../../observability/agent-runner';
import { extractModelUsage } from '../../observability/usage';
import { z } from 'zod';
import {
  performDeterministicAudit,
  enforceDeterministicDecision,
} from './deterministic-audit';

const agentNameSchema = z.enum([
  'SALES',
  'LOGISTICS',
  'CUSTOMER_EXPERIENCE',
  'SELLER_PERFORMANCE',
  'ANOMALY',
  'DATA_SCIENCE',
]);

const criticOutputSchema = z.object({
  decision: z.enum([
    'APPROVED',
    'APPROVED_WITH_WARNINGS',
    'REQUIRES_MORE_ANALYSIS',
    'REJECTED',
  ]),
  score: z.number().min(0).max(100),
  feedback: z.string().min(1),
  requestedAgents: z.array(agentNameSchema).default([]),
  requiredActions: z.array(z.string().min(1)).default([]),
});

export function createCriticNode(streaming: StreamingService) {
  return async (state: CommerceOpsStateType) => {
    const { investigationId, findings, evidence, iteration } = state;
    const currentIteration = iteration || 1;
    const modelName = process.env.OPENAI_CRITIC_MODEL || 'gpt-4o';

    streaming.emit(investigationId, 'agent.started', { agent: 'CRITIC' });

    // Deterministic audit checks (V4.4)
    const audit = performDeterministicAudit({
      userQuestion: state.userQuestion,
      requiredCapabilities: state.requiredCapabilities || [],
      requiredAnswerComponents: state.requiredAnswerComponents || [],
      selectedAgents: state.selectedAgents || [],
      findings,
      evidence,
      answerCoverage: state.answerCoverage || [],
    });

    // Merge per-finding audit results into findings
    const perFindingMap = new Map(
      audit.perFindingResults.map((r) => [r.findingId, r]),
    );
    const updatedFindings: Finding[] = findings.map((f) => {
      const auditRes = perFindingMap.get(f.id);
      if (auditRes) {
        return {
          ...f,
          auditStatus: auditRes.status,
          auditMessages: [...auditRes.errors, ...auditRes.warnings],
          evidenceQuality: auditRes.evidenceQuality,
        };
      }
      return f;
    });

    const { result, trace: agentTrace } = await runAgentWithTrace({
      agentName: 'CRITIC',
      iteration: currentIteration,
      investigationId,
      modelName,
      execute: async () => {
        const model = new ChatOpenAI({
          modelName,
          temperature: 0.1,
          apiKey: process.env.OPENAI_API_KEY,
        });

        const prompt = `Eres el Evidence Critic de CommerceOps AI, el agente encargado de auditar la calidad, consistencia y evidencia de todos los hallazgos producidos por el equipo multiagente.

Hallazgos a evaluar (${updatedFindings.length}):
${JSON.stringify(updatedFindings, null, 2)}

Evidencias registrables (${evidence.length}):
${JSON.stringify(evidence, null, 2)}

Auditoría determinista V4.2 previa:
${audit.criticalErrors.length > 0 ? `ERRORES CRÍTICOS:\n${audit.criticalErrors.join('\n')}` : 'Sin errores críticos.'}
${audit.warnings.length > 0 ? `ADVERTENCIAS:\n${audit.warnings.join('\n')}` : 'Sin advertencias.'}

Evalúa si la evidencia respalda suficientemente las conclusiones y decide el resultado:
- APPROVED: La evidencia es suficiente y consistente.
- APPROVED_WITH_WARNINGS: La evidencia es aceptable pero hay observaciones menores.
- REQUIRES_MORE_ANALYSIS: Falta información clave o se requiere una segunda iteración.
- REJECTED: Los hallazgos carecen de soporte o son contradictorios.

Responde estrictamente en formato JSON:
{
  "decision": "APPROVED",
  "score": 92,
  "feedback": "Los hallazgos cuentan con evidencias numéricas válidas.",
  "requestedAgents": [],
  "requiredActions": []
}`;

        let rawDecision: CriticDecision =
          audit.criticalErrors.length > 0
            ? 'REQUIRES_MORE_ANALYSIS'
            : audit.warnings.length > 0
              ? 'APPROVED_WITH_WARNINGS'
              : 'APPROVED';
        let score = audit.criticalErrors.length > 0 ? 55 : 88;
        let feedback =
          audit.criticalErrors.length > 0
            ? `Alertas deterministas críticas detectadas: ${audit.criticalErrors.join(' | ')}`
            : 'Evidencia verificada determinísticamente por rúbrica V4.2.';
        let requestedAgents: AgentName[] = [];
        let requiredActions: string[] = [];
        let inputTokens: number | undefined;
        let outputTokens: number | undefined;

        try {
          const response = await model.invoke(prompt);
          const usage = extractModelUsage(response);
          inputTokens = usage.inputTokens;
          outputTokens = usage.outputTokens;

          const content =
            typeof response.content === 'string'
              ? response.content
              : JSON.stringify(response.content);
          const match = content.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            const validation = criticOutputSchema.safeParse(parsed);
            if (validation.success) {
              rawDecision = validation.data.decision;
              score = validation.data.score;
              feedback = validation.data.feedback;
              requestedAgents = validation.data.requestedAgents;
              requiredActions = validation.data.requiredActions;
            }
          }
        } catch (err) {
          console.warn('[CriticNode] Error executing LLM call:', err);
          rawDecision =
            audit.criticalErrors.length > 0
              ? 'REQUIRES_MORE_ANALYSIS'
              : 'APPROVED_WITH_WARNINGS';
          score = 75;
          feedback =
            'Auditoría determinista V4.2 completada. LLM complementario no disponible.';
        }

        const enforced = enforceDeterministicDecision(rawDecision, audit);
        const finalDecision = enforced.decision;
        if (enforced.enforcedReason) {
          feedback = `${feedback} (${enforced.enforcedReason})`;
        }

        if (
          finalDecision === 'REQUIRES_MORE_ANALYSIS' &&
          requestedAgents.length === 0
        ) {
          const affectedAgents = new Set<AgentName>(audit.missingAgents || []);
          for (const f of updatedFindings) {
            if (audit.perFinding[f.id]?.criticalErrors?.length > 0) {
              affectedAgents.add(f.agent || 'LOGISTICS');
            }
          }
          requestedAgents = Array.from(affectedAgents);
        }

        return {
          result: {
            finalDecision,
            score,
            feedback,
            requestedAgents,
            requiredActions,
          },
          inputTokens,
          outputTokens,
        };
      },
    });

    const criticFeedbackItem = {
      id: `critic-${Date.now()}`,
      investigationId,
      severity: (() => {
        if (result.finalDecision === 'APPROVED') return 'LOW' as const;
        if (result.finalDecision === 'APPROVED_WITH_WARNINGS')
          return 'MEDIUM' as const;
        return 'HIGH' as const;
      })(),
      message: result.feedback,
      requiredAction: result.requiredActions.join(' | ') || undefined,
      status:
        result.finalDecision === 'APPROVED' ||
        result.finalDecision === 'APPROVED_WITH_WARNINGS'
          ? ('RESOLVED' as const)
          : ('PENDING' as const),
      createdAt: new Date().toISOString(),
    };

    streaming.emit(investigationId, 'critic.feedback', {
      agent: 'CRITIC',
      decision: result.finalDecision,
      score: result.score,
      feedback: result.feedback,
    });

    streaming.emit(investigationId, 'agent.completed', {
      agent: 'CRITIC',
      decision: result.finalDecision,
    });

    return {
      completedAgents: [...state.completedAgents, 'CRITIC' as const],
      findings: updatedFindings,
      criticFeedback: [criticFeedbackItem],
      criticDecision: result.finalDecision,
      criticScore: result.score,
      requestedAgents: result.requestedAgents,
      agentRunTraces: [agentTrace],
      iteration: state.iteration + 1,
    };
  };
}
