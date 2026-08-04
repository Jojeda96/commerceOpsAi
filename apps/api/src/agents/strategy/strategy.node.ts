import { ChatOpenAI } from '@langchain/openai';
import { Recommendation, Finding } from '@commerce-ops/shared-types';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { StreamingService } from '../../streaming/streaming.service';
import { runAgentWithTrace } from '../../observability/agent-runner';
import { extractModelUsage } from '../../observability/usage';
import { validateRecommendation } from './recommendation-validator';
import { validateRecommendationSupport } from './recommendation-support-policy';

export function createStrategyNode(streaming: StreamingService) {
  return async (state: CommerceOpsStateType) => {
    const { investigationId, userQuestion, findings, evidence, iteration } =
      state;
    const currentIteration = iteration || 1;
    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    streaming.emit(investigationId, 'agent.started', { agent: 'STRATEGY' });

    const { result, trace: agentTrace } = await runAgentWithTrace({
      agentName: 'STRATEGY',
      iteration: currentIteration,
      investigationId,
      modelName,
      execute: async () => {
        const actionableFindings = findings.filter(
          (f: Finding) =>
            f.operationalStatus !== 'BLOCKED' &&
            f.operationalStatus !== 'EXPERIMENTAL_CONTEXT',
        );

        const experimentalFindings = findings.filter(
          (f: Finding) => f.operationalStatus === 'EXPERIMENTAL_CONTEXT',
        );

        const rawRecs: Recommendation[] = [];

        if (actionableFindings.length === 0) {
          console.warn(
            '[StrategyNode] No existen hallazgos accionables para respaldar recomendaciones operativas.',
          );
          return {
            result: [],
          };
        }

        const model = new ChatOpenAI({
          modelName,
          temperature: 0.3,
          apiKey: process.env.OPENAI_API_KEY,
        });

        const prompt = `Eres el Business Strategy Agent de CommerceOps AI.
Tu tarea es convertir hallazgos técnicos ACCIONABLES en recomendaciones empresariales priorizadas y epistémicamente transparentes.

Pregunta del usuario: "${userQuestion}"
Hallazgos ACCIONABLES:
${JSON.stringify(actionableFindings, null, 2)}

${
  experimentalFindings.length > 0
    ? `NOTA DE GOBERNANZA: Existen ${experimentalFindings.length} hallazgos experimentales no aprobados que NO deben ser utilizados para recomendaciones operativas.`
    : ''
}

REGLAS DE RIGOR METODOLÓGICO:
1. NO inventes cifras ni proyectes reducciones de % sin simulación.
2. NO utilices el término "tiempo real". Utiliza "monitoreo periódico" o "ejecución programada".
3. Clasifica la recomendación en una de estas clases: "EVIDENCE_BACKED_ACTION", "HYPOTHESIS_TO_TEST", "MONITORING_ACTION", "DATA_QUALITY_ACTION".

Genera 2 recomendaciones ejecutivas en formato JSON estricto:
{
  "recommendations": [
    {
      "title": "Título estratégico",
      "description": "Descripción detallada de la acción recomendada.",
      "priority": "HIGH",
      "kind": "MONITORING_ACTION",
      "expectedImpact": "Métrica histórica afectada: lateRate. La magnitud futura requiere simulación cuantitativa.",
      "assumptions": ["Los patrones históricos observados se mantienen."]
    }
  ]
}`;

        const actionableIds = new Set(actionableFindings.map((f) => f.id));
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
            if (Array.isArray(parsed.recommendations)) {
              for (const item of parsed.recommendations) {
                const rawSupportIds = Array.isArray(item.supportingFindingIds)
                  ? item.supportingFindingIds
                  : Array.from(actionableIds);

                const validSupportIds = rawSupportIds.filter((id: string) =>
                  actionableIds.has(id),
                );

                const rec: Recommendation = {
                  id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  investigationId,
                  title: item.title || 'Recomendación operacional',
                  description:
                    item.description || 'Implementar monitoreo continuo.',
                  priority: item.priority || 'MEDIUM',
                  kind: item.kind || 'HYPOTHESIS_TO_TEST',
                  expectedImpact:
                    item.expectedImpact ||
                    'Métrica afectada según hallazgos accionables.',
                  supportingFindingIds:
                    validSupportIds.length > 0
                      ? validSupportIds
                      : Array.from(actionableIds),
                  assumptions: item.assumptions || [],
                  createdAt: new Date().toISOString(),
                };
                rawRecs.push(rec);
              }
            }
          }
        } catch (err) {
          console.warn('[StrategyNode] Error creating recommendations:', err);
        }

        if (rawRecs.length === 0 && actionableFindings.length > 0) {
          rawRecs.push({
            id: `rec-default-${Date.now()}`,
            investigationId,
            title:
              'Programar monitoreo periódico de la tasa mensual de atrasos',
            description:
              'Verificar tamaño muestral, estabilidad temporal y composición por vendedor/categoría.',
            priority: 'HIGH',
            kind: 'MONITORING_ACTION',
            expectedImpact: 'Métrica histórica afectada: lateRate.',
            supportingFindingIds: Array.from(actionableIds),
            assumptions: ['Los datos históricos reflejan la tendencia actual.'],
            createdAt: new Date().toISOString(),
          });
        }

        // Pass through recommendation validator & support policy (V4.4)
        const validatedRecs: Recommendation[] = [];
        for (const raw of rawRecs) {
          const valRes = validateRecommendation(raw, findings, evidence);
          validatedRecs.push(valRes.recommendation);
        }

        const answeredComponents = (state.answerCoverage || [])
          .filter((c) => c.status === 'ANSWERED')
          .map((c) => c.component);
        const unavailableComponents = (state.answerCoverage || [])
          .filter(
            (c) =>
              c.status === 'UNAVAILABLE_WITH_REASON' ||
              c.status === 'UNANSWERED',
          )
          .map((c) => c.component);

        const supportValidation = validateRecommendationSupport({
          recommendations: validatedRecs as any[],
          findings,
          answeredComponents,
          unavailableComponents,
        });

        const finalRecs = supportValidation.acceptedRecommendations as Recommendation[];

        for (const rec of finalRecs) {
          streaming.emit(investigationId, 'recommendation.created', {
            agent: 'STRATEGY',
            recommendation: rec,
          });
        }

        return {
          result: finalRecs,
          inputTokens,
          outputTokens,
        };
      },
    });

    streaming.emit(investigationId, 'agent.completed', {
      agent: 'STRATEGY',
    });

    return {
      completedAgents: [...state.completedAgents, 'STRATEGY' as const],
      agentRunTraces: [agentTrace],
      recommendations: result,
    };
  };
}
