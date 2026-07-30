import { ChatOpenAI } from '@langchain/openai';
import { Recommendation, Finding } from '@commerce-ops/shared-types';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { StreamingService } from '../../streaming/streaming.service';

export function createStrategyNode(streaming: StreamingService) {
  return async (state: CommerceOpsStateType) => {
    const { investigationId, userQuestion, findings } = state;

    streaming.emit(investigationId, 'agent.started', { agent: 'STRATEGY' });

    const actionableFindings = findings.filter(
      (f: Finding) =>
        f.operationalStatus !== 'BLOCKED' &&
        f.operationalStatus !== 'EXPERIMENTAL_CONTEXT',
    );

    const experimentalFindings = findings.filter(
      (f: Finding) => f.operationalStatus === 'EXPERIMENTAL_CONTEXT',
    );

    const recs: Recommendation[] = [];

    if (actionableFindings.length === 0) {
      console.warn('[StrategyNode] No existen hallazgos accionables para respaldar recomendaciones operativas.');
      streaming.emit(investigationId, 'agent.completed', { agent: 'STRATEGY' });
      return {
        completedAgents: [...state.completedAgents, 'STRATEGY' as const],
        recommendations: [],
      };
    }

    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.3,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `Eres el Business Strategy Agent de CommerceOps AI.
Tu tarea es convertir hallazgos técnicos ACCIONABLES en recomendaciones empresariales priorizadas.

Pregunta del usuario: "${userQuestion}"
Hallazgos ACCIONABLES (Modelos/Operaciones Aprobados):
${JSON.stringify(actionableFindings, null, 2)}

${
  experimentalFindings.length > 0
    ? `NOTA DE GOBERNANZA: Existen ${experimentalFindings.length} hallazgos experimentales no aprobados que NO deben ser utilizados para recomendaciones operativas.`
    : ''
}

REGLAS STRICTAS PARA "expectedImpact":
1. NO inventes cifras, reducciones porcentuales ni cálculos no presentes en los hallazgos.
2. NO menciones factores externos no registrados en la base de datos (clima, tráfico, huelgas).
3. Ejemplo de formato válido: "Métrica histórica afectada: lateRate. La magnitud futura requiere una simulación cuantitativa separada."

Genera 2 recomendaciones ejecutivas en formato JSON estricto:
{
  "recommendations": [
    {
      "title": "Título corto y estratégico",
      "description": "Descripción detallada de la acción recomendada.",
      "priority": "HIGH",
      "expectedImpact": "Métrica histórica afectada: lateRate. La magnitud futura requiere una simulación cuantitativa separada.",
      "assumptions": ["Los patrones históricos observados se mantienen."]
    }
  ]
}`;

    const actionableIds = new Set(actionableFindings.map((f) => f.id));

    try {
      const response = await model.invoke(prompt);
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

            // Filtrar estricto: no citar hallazgos experimentales o inexistentes
            const validSupportIds = rawSupportIds.filter((id: string) => actionableIds.has(id));

            const rec: Recommendation = {
              id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              investigationId,
              title: item.title || 'Recomendación operacional',
              description: item.description || 'Implementar monitoreo continuo.',
              priority: item.priority || 'MEDIUM',
              expectedImpact: item.expectedImpact || 'Métrica afectada según hallazgos accionables.',
              supportingFindingIds: validSupportIds.length > 0 ? validSupportIds : Array.from(actionableIds),
              assumptions: item.assumptions || [],
              createdAt: new Date().toISOString(),
            };
            recs.push(rec);
            streaming.emit(investigationId, 'recommendation.created', {
              agent: 'STRATEGY',
              recommendation: rec,
            });
          }
        }
      }
    } catch (err) {
      console.warn('[StrategyNode] Error creating recommendations:', err);
    }

    if (recs.length === 0 && actionableFindings.length > 0) {
      recs.push({
        id: `rec-default-${Date.now()}`,
        investigationId,
        title: 'Establecer monitoreo de SLA en rutas con mayor retraso',
        description: 'Revisar acuerdos con transportistas y capacidad del vendedor.',
        priority: 'HIGH',
        expectedImpact: 'Métrica histórica afectada: lateRate.',
        supportingFindingIds: Array.from(actionableIds),
        assumptions: ['Los datos históricos reflejan la tendencia actual.'],
        createdAt: new Date().toISOString(),
      });
    }

    streaming.emit(investigationId, 'agent.completed', { agent: 'STRATEGY' });

    return {
      completedAgents: [...state.completedAgents, 'STRATEGY' as const],
      recommendations: recs,
    };
  };
}
