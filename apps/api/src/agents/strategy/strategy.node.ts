import { ChatOpenAI } from '@langchain/openai';
import { Recommendation } from '@commerce-ops/shared-types';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { StreamingService } from '../../streaming/streaming.service';

export function createStrategyNode(streaming: StreamingService) {
  return async (state: CommerceOpsStateType) => {
    const { investigationId, userQuestion, findings } = state;

    streaming.emit(investigationId, 'agent.started', { agent: 'STRATEGY' });

    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.3,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `Eres el Business Strategy Agent de CommerceOps AI.
Tu tarea es convertir los hallazgos técnicos en recomendaciones empresariales accionables, priorizadas y cuantitativamente justificadas.

Pregunta del usuario: "${userQuestion}"
Hallazgos aprobados de los agentes:
${JSON.stringify(findings, null, 2)}

Instrucciones para "expectedImpact":
- Calcula o proyecta la mejora basándote en los datos numéricos reales de los hallazgos (ej. si hay 7,826 pedidos atrasados con 9.6 días de retraso promedio, proyecta el porcentaje de reducción razonable al resolver el cuello de botella).
- Formato sugerido: "Reducción estimada del X% en atrasos (~Y pedidos recuperados)." o "Mejora proyectada del X% en tiempos de despacho."

Genera 2 recomendaciones ejecutivas en formato JSON estricto:
{
  "recommendations": [
    {
      "title": "Título corto y estratégico de la acción 1",
      "description": "Descripción detallada de la acción operativa recomendada.",
      "priority": "HIGH",
      "expectedImpact": "Reducción estimada del 15% en la tasa de atrasos (recuperación de ~1,170 pedidos dentro del SLA).",
      "assumptions": ["Capacidad operativa del transportista se mantiene constante."]
    }
  ]
}`;

    const recs: Recommendation[] = [];

    try {
      const response = await model.invoke(prompt);
      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed.recommendations)) {
          for (const item of parsed.recommendations) {
            const rec: Recommendation = {
              id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              investigationId,
              title: item.title || 'Recomendación operacional',
              description: item.description || 'Implementar monitoreo continuo.',
              priority: item.priority || 'MEDIUM',
              expectedImpact: item.expectedImpact || 'Impacto positivo en la operación.',
              supportingFindingIds: findings.map((f) => f.id),
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

    if (recs.length === 0) {
      recs.push({
        id: `rec-default-${Date.now()}`,
        investigationId,
        title: 'Establecer monitoreo de SLA en rutas con mayor retraso',
        description: 'Revisar acuerdos con transportistas y capacidad del vendedor.',
        priority: 'HIGH',
        expectedImpact: 'Mejora en la satisfacción del cliente.',
        supportingFindingIds: findings.map((f) => f.id),
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
