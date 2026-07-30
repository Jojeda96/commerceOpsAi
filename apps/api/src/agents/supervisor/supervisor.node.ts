import { ChatOpenAI } from '@langchain/openai';
import { AgentName } from '@commerce-ops/shared-types';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';
import { runAgentWithTrace } from '../../observability/agent-runner';
import { extractModelUsage } from '../../observability/usage';
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
    const {
      userQuestion,
      investigationId,
      filters,
      criticFeedback,
      iteration,
    } = state;
    const currentIteration = iteration || 1;
    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    streaming.emit(investigationId, 'agent.started', {
      agent: 'SUPERVISOR',
      question: userQuestion,
      iteration: currentIteration,
    });

    const isReiteration =
      currentIteration > 0 && criticFeedback && criticFeedback.length > 0;
    const latestFeedback = isReiteration
      ? criticFeedback[criticFeedback.length - 1]
      : null;

    const { result, trace: agentTrace } = await runAgentWithTrace({
      agentName: 'SUPERVISOR',
      iteration: currentIteration,
      modelName,
      execute: async () => {
        const model = new ChatOpenAI({
          modelName,
          temperature: 0.1,
          apiKey: process.env.OPENAI_API_KEY,
        });

        const prompt = `Eres el Operations Supervisor de CommerceOps AI (Iteración ${currentIteration}).
Tu tarea es analizar la pregunta del usuario, seleccionar los agentes especialistas necesarios y definir el plan operacional.

Pregunta del usuario: "${userQuestion}"

${
  isReiteration
    ? `⚠️ ATENCIÓN - FEEDBACK DE ITERACIÓN PREVIA DEL EVIDENCE CRITIC:
${latestFeedback?.message}
Acción requerida: ${latestFeedback?.requiredAction || 'Revisar y profundizar el análisis'}`
    : ''
}

Filtros previos existentes:
${JSON.stringify(filters || {}, null, 2)}

Agentes especialistas disponibles:
1. SALES: Ventas, facturación, volumen de pedidos, ticket promedio, métodos de pago y AOV.
2. LOGISTICS: Entregas a tiempo, tasa de atrasos (lateRate DESC), tiempos de transporte, fletes y SLAs.
3. CUSTOMER_EXPERIENCE: Calificaciones (1-5 estrellas), análisis NLP de reseñas de clientes, filtrado por fecha/categoría.
4. SELLER_PERFORMANCE: Ficha de vendedor, ranking por GMV, scorecards y comparaciones entre pares.
5. ANOMALY: Detección de comportamientos inusuales, outliers de flete y picos repentinos.
6. DATA_SCIENCE: Modelos predictivos de riesgo de atraso en escenarios representativos reales.

Responde estrictamente en formato JSON:
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
            '[SupervisorNode] Error parsing LLM response, using default plan:',
            err,
          );
        }

        // Reiteración dirigida: si el Critic solicitó agentes específicos, forzarlos obligatoriamente
        if (
          state.iteration > 0 &&
          state.requestedAgents &&
          state.requestedAgents.length > 0
        ) {
          selectedAgents = Array.from(
            new Set([...selectedAgents, ...state.requestedAgents]),
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
          result: {
            selectedAgents,
            tasks,
            mergedFilters,
          },
          inputTokens,
          outputTokens,
        };
      },
    });

    return {
      activeAgents: result.selectedAgents,
      investigationPlan: result.tasks,
      filters: result.mergedFilters,
      agentRunTraces: [agentTrace],
    };
  };
}
