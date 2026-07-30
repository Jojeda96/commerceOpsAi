import { ChatOpenAI } from '@langchain/openai';
import { AgentName } from '@commerce-ops/shared-types';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';

import { z } from 'zod';

const supervisorOutputSchema = z.object({
  selectedAgents: z.array(
    z.enum([
      'SALES',
      'LOGISTICS',
      'CUSTOMER_EXPERIENCE',
      'SELLER_PERFORMANCE',
      'ANOMALY',
      'DATA_SCIENCE',
    ]),
  ),
  resolvedFilters: z
    .object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      categories: z.array(z.string()).optional(),
      sellerIds: z.array(z.string()).optional(),
      customerStates: z.array(z.string()).optional(),
    })
    .optional(),
  plan: z.array(
    z.object({
      agentName: z.string(),
      objective: z.string(),
    }),
  ),
});

export function createSupervisorNode(
  prisma: PrismaService,
  streaming: StreamingService,
) {
  return async (state: CommerceOpsStateType) => {
    const { userQuestion, investigationId, filters } = state;

    streaming.emit(investigationId, 'agent.started', {
      agent: 'SUPERVISOR',
      question: userQuestion,
    });

    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.1,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `Eres el Operations Supervisor de CommerceOps AI. Tu tarea es analizar la pregunta del usuario, seleccionar los agentes especialistas necesarios para resolver el problema operacional y extraer cualquier filtro de fecha (ej. "febrero de 2018" -> dateFrom: "2018-02-01", dateTo: "2018-02-28"), categorías o estados mencionados explícita o implícitamente en la consulta.

Pregunta del usuario: "${userQuestion}"

Filtros previos existentes:
${JSON.stringify(filters || {}, null, 2)}

Agentes especialistas disponibles:
1. SALES: Ventas, facturación, volumen de pedidos, ticket promedio, distribución por categoría y métodos de pago.
2. LOGISTICS: Entregas a tiempo, tasa de atrasos, tiempos de transporte, fletes y SLAs por región.
3. CUSTOMER_EXPERIENCE: Calificaciones (1-5 estrellas), análisis de reseñas de clientes, sentimiento y temas frecuentes de reclamos.
4. SELLER_PERFORMANCE: Ficha de vendedor, scorecards, riesgo operacional, comparaciones entre pares y cancelaciones.
5. ANOMALY: Detección de comportamientos inusuales, outliers de flete, picos repentinos en métricas o reclamos.
6. DATA_SCIENCE: Modelos predictivos de probabilidad de atraso, probabilidad de baja calificación y explicaciones heurísticas.

Responde estrictamente en formato JSON con la siguiente estructura:
{
  "selectedAgents": ["LOGISTICS", "CUSTOMER_EXPERIENCE"],
  "resolvedFilters": {
    "dateFrom": "2018-02-01",
    "dateTo": "2018-02-28"
  },
  "plan": [
    {
      "agentName": "LOGISTICS",
      "objective": "Analizar la tasa de atrasos en entregas para febrero de 2018."
    }
  ]
}`;

    let selectedAgents: AgentName[] = [
      'SALES',
      'LOGISTICS',
      'CUSTOMER_EXPERIENCE',
    ];
    let planTasks: any[] = [];
    let extractedFilters: any = {};

    try {
      const response = await model.invoke(prompt);
      const content =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const validation = supervisorOutputSchema.safeParse(parsed);
        if (validation.success) {
          if (validation.data.selectedAgents.length > 0) {
            selectedAgents = validation.data.selectedAgents;
          }
          if (validation.data.plan) {
            planTasks = validation.data.plan;
          }
          if (validation.data.resolvedFilters) {
            extractedFilters = validation.data.resolvedFilters;
          }
        }
      }
    } catch (err) {
      console.warn(
        '[SupervisorNode] Error parsing LLM response, using default fallback plan:',
        err,
      );
    }

    const mergedFilters = {
      ...filters,
      ...extractedFilters,
    };

    const tasks = planTasks.map((t, idx) => ({
      id: `task-${idx + 1}`,
      investigationId,
      agentName: t.agentName as AgentName,
      objective: t.objective || 'Analizar métricas correspondientes',
      status: 'PENDING' as const,
    }));

    streaming.emit(investigationId, 'plan.created', {
      selectedAgents,
      resolvedFilters: mergedFilters,
      tasksCount: tasks.length,
    });

    streaming.emit(investigationId, 'agent.completed', {
      agent: 'SUPERVISOR',
      selectedAgents,
    });

    return {
      activeAgents: selectedAgents,
      investigationPlan: tasks,
      filters: mergedFilters,
    };
  };
}
