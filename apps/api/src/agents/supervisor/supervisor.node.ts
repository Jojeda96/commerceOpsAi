import { ChatOpenAI } from '@langchain/openai';
import { AgentName } from '@commerce-ops/shared-types';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';

export function createSupervisorNode(
  prisma: PrismaService,
  streaming: StreamingService,
) {
  return async (state: CommerceOpsStateType) => {
    const { userQuestion, investigationId } = state;

    streaming.emit(investigationId, 'agent.started', {
      agent: 'SUPERVISOR',
      question: userQuestion,
    });

    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `Eres el Operations Supervisor de CommerceOps AI. Tu tarea es analizar la pregunta del usuario y seleccionar los agentes especialistas necesarios para resolver el problema operacional.

Pregunta del usuario: "${userQuestion}"

Agentes especialistas disponibles:
1. SALES: Ventas, facturación, volumen de pedidos, ticket promedio, distribución por categoría y métodos de pago.
2. LOGISTICS: Entregas a tiempo, tasa de atrasos, tiempos de transporte, fletes y SLAs por región.
3. CUSTOMER_EXPERIENCE: Calificaciones (1-5 estrellas), análisis de reseñas de clientes, sentimiento y temas frecuentes de reclamos.
4. SELLER_PERFORMANCE: Ficha de vendedor, scorecards, riesgo operacional, comparaciones entre pares y cancelaciones.
5. ANOMALY: Detección de comportamientos inusuales, outliers de flete, picos repentinos en métricas o reclamos.
6. DATA_SCIENCE: Modelos predictivos de probabilidad de atraso, probabilidad de baja calificación y SHAP explanations.

Responde estrictamente en formato JSON con la siguiente estructura:
{
  "selectedAgents": ["LOGISTICS", "CUSTOMER_EXPERIENCE"],
  "plan": [
    {
      "agentName": "LOGISTICS",
      "objective": "Analizar la tasa de atrasos en entregas para el periodo relevante."
    },
    {
      "agentName": "CUSTOMER_EXPERIENCE",
      "objective": "Analizar la evolución de calificaciones y los temas de quejas en las reseñas."
    }
  ]
}`;

    let selectedAgents: AgentName[] = [
      'SALES',
      'LOGISTICS',
      'CUSTOMER_EXPERIENCE',
    ];
    let planTasks: any[] = [];

    try {
      const response = await model.invoke(prompt);
      const content =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (
          Array.isArray(parsed.selectedAgents) &&
          parsed.selectedAgents.length > 0
        ) {
          selectedAgents = parsed.selectedAgents as AgentName[];
        }
        if (Array.isArray(parsed.plan)) {
          planTasks = parsed.plan;
        }
      }
    } catch (err) {
      console.warn(
        '[SupervisorNode] Error parsing LLM response, using default fallback plan:',
        err,
      );
    }

    const tasks = planTasks.map((t, idx) => ({
      id: `task-${idx + 1}`,
      investigationId,
      agentName: t.agentName as AgentName,
      objective: t.objective || 'Analizar métricas correspondientes',
      status: 'PENDING' as const,
    }));

    streaming.emit(investigationId, 'plan.created', {
      selectedAgents,
      tasksCount: tasks.length,
    });

    streaming.emit(investigationId, 'agent.completed', {
      agent: 'SUPERVISOR',
      selectedAgents,
    });

    return {
      activeAgents: selectedAgents,
      investigationPlan: tasks,
    };
  };
}
