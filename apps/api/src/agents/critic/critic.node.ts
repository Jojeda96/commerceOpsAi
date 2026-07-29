import { ChatOpenAI } from '@langchain/openai';
import { CriticDecision } from '@commerce-ops/shared-types';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { StreamingService } from '../../streaming/streaming.service';

export function createCriticNode(streaming: StreamingService) {
  return async (state: CommerceOpsStateType) => {
    const { investigationId, findings, evidence } = state;

    streaming.emit(investigationId, 'agent.started', { agent: 'CRITIC' });

    // Deterministic audit checks (P1-7)
    const deterministicWarnings: string[] = [];
    for (const f of findings) {
      const linked = evidence.filter((e) => (f.evidenceIds && f.evidenceIds.includes(e.id)) || e.id.includes(f.id));
      if (linked.length === 0) {
        deterministicWarnings.push(`El hallazgo "${f.title}" no posee evidencia registrada.`);
      }
      const causalTerms = ['causó', 'provocó', 'demuestra que', 'debido únicamente a'];
      const text = `${f.title} ${f.description}`;
      const foundCausal = causalTerms.filter((term) => text.toLowerCase().includes(term));
      if (foundCausal.length > 0) {
        deterministicWarnings.push(`El hallazgo "${f.title}" contiene afirmaciones de causalidad estricta (${foundCausal.join(', ')}).`);
      }
    }

    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_CRITIC_MODEL || 'gpt-4o',
      temperature: 0.1,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `Eres el Evidence Critic de CommerceOps AI, el agente encargado de auditar la calidad, consistencia y evidencia de todos los hallazgos producidos por el equipo multiagente.

Hallazgos a evaluar (${findings.length}):
${JSON.stringify(findings, null, 2)}

Evidencias registrables (${evidence.length}):
${JSON.stringify(evidence, null, 2)}

Auditoría determinista previa:
${deterministicWarnings.length > 0 ? deterministicWarnings.join('\n') : 'Sin alertas deterministas detectadas.'}

Evalúa si la evidencia respalda suficientemente las conclusiones y decide el resultado:
- APPROVED: La evidencia es suficiente y consistente.
- APPROVED_WITH_WARNINGS: La evidencia es aceptable pero hay observaciones menores.
- REQUIRES_MORE_ANALYSIS: Falta información clave o se requiere una segunda iteración.
- REJECTED: Los hallazgos carecen de soporte o son contradictorios.

Responde strictly en formato JSON con la siguiente estructura:
{
  "decision": "APPROVED",
  "score": 92,
  "feedback": "Los hallazgos de ventas y logística cuentan con evidencias numéricas válidas."
}`;

    // Default fallback on error (P0-10): Do NOT auto-approve with 90 on LLM failure!
    let decision: CriticDecision = deterministicWarnings.length > 0 ? 'REQUIRES_MORE_ANALYSIS' : 'APPROVED';
    let score = deterministicWarnings.length > 0 ? 60 : 85;
    let feedback = deterministicWarnings.length > 0
      ? `Alertas deterministas detectadas: ${deterministicWarnings.join(' ')}`
      : 'Evidencia preliminarmente verificada.';

    try {
      const response = await model.invoke(prompt);
      const content =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.decision) decision = parsed.decision as CriticDecision;
        if (typeof parsed.score === 'number') score = parsed.score;
        if (parsed.feedback) feedback = parsed.feedback;
      }
    } catch (err) {
      console.warn('[CriticNode] Error executing LLM call:', err);
      // Ensure failure falls back safely instead of auto-approving
      decision = 'REQUIRES_MORE_ANALYSIS';
      score = 50;
      feedback = 'No se pudo completar la auditoría del LLM. Se requiere revisión adicional.';
    }

    const criticFeedbackItem = {
      id: `critic-${Date.now()}`,
      investigationId,
      severity: (() => {
        if (decision === 'APPROVED') return 'LOW' as const;
        if (decision === 'APPROVED_WITH_WARNINGS') return 'MEDIUM' as const;
        return 'HIGH' as const; // REQUIRES_MORE_ANALYSIS o REJECTED
      })(),
      message: feedback,
      status: (decision === 'APPROVED' || decision === 'APPROVED_WITH_WARNINGS' ? 'RESOLVED' : 'PENDING') as 'RESOLVED' | 'PENDING',
      createdAt: new Date().toISOString(),
    };

    streaming.emit(investigationId, 'critic.feedback', {
      agent: 'CRITIC',
      decision,
      score,
      feedback,
    });

    streaming.emit(investigationId, 'agent.completed', {
      agent: 'CRITIC',
      decision,
    });

    return {
      completedAgents: [...state.completedAgents, 'CRITIC' as const],
      criticFeedback: [criticFeedbackItem],
      criticDecision: decision,
      criticScore: score,
      iteration: state.iteration + 1,
    };
  };
}
