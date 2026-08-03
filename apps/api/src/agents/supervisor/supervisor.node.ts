import { ChatOpenAI } from '@langchain/openai';
import { AgentName } from '@commerce-ops/shared-types';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';
import { runAgentWithTrace } from '../../observability/agent-runner';
import { extractModelUsage } from '../../observability/usage';
import { resolveAnalysisScope } from '../scope/analysis-scope.resolver';
import { classifyCapabilities } from './capability-classifier';
import { mapCapabilitiesToAgents } from './capability-agent-map';
import { z } from 'zod';

const supervisorOutputSchema = z.object({
  requiredCapabilities: z.array(z.string()).optional(),
  selectedAgents: z
    .array(
      z.enum([
        'SALES',
        'LOGISTICS',
        'CUSTOMER_EXPERIENCE',
        'SELLER_PERFORMANCE',
        'ANOMALY',
        'DATA_SCIENCE',
      ]),
    )
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
      requestedAgents,
    } = state;
    const currentIteration = iteration || 1;
    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    streaming.emit(investigationId, 'agent.started', {
      agent: 'SUPERVISOR',
      question: userQuestion,
      iteration: currentIteration,
    });

    const isReiteration = currentIteration > 1;

    // 1. Resolve canonical AnalysisScope deterministically
    const analysisScope = resolveAnalysisScope({
      question: userQuestion,
      dtoFilters: filters,
    });

    // 2. Classify capabilities and agents deterministically
    const deterministicCapabilities = classifyCapabilities(userQuestion);
    const deterministicAgents = mapCapabilitiesToAgents(
      deterministicCapabilities,
    );

    const { result, trace: agentTrace } = await runAgentWithTrace({
      agentName: 'SUPERVISOR',
      iteration: currentIteration,
      investigationId,
      modelName,
      execute: async () => {
        const model = new ChatOpenAI({
          modelName,
          temperature: 0.1,
          apiKey: process.env.OPENAI_API_KEY,
        });

        const prompt = `Eres el Operations Supervisor de CommerceOps AI (Iteración ${currentIteration}).
Tu tarea es analizar la pregunta del usuario, estructurar los objetivos del plan y confirmar los agentes seleccionados.

Pregunta del usuario: "${userQuestion}"

${
  isReiteration && criticFeedback && criticFeedback.length > 0
    ? `⚠️ FEEDBACK DE ITERACIÓN PREVIA DEL EVIDENCE CRITIC:
${criticFeedback[criticFeedback.length - 1].message}`
    : ''
}

Scope de análisis inmutable asignado (Hash: ${analysisScope.scopeHash}):
${JSON.stringify(analysisScope, null, 2)}

Agentes seleccionados determinísticamente:
${deterministicAgents.join(', ')}

Responde estrictamente en formato JSON sin inventar campos de filtros:
{
  "requiredCapabilities": ${JSON.stringify(deterministicCapabilities)},
  "selectedAgents": ${JSON.stringify(deterministicAgents)},
  "plan": [
    {
      "agentName": "${deterministicAgents[0] || 'LOGISTICS'}",
      "objective": "Analizar métricas logísticas y contexto para el scope asignado."
    }
  ]
}`;

        let selectedAgents: AgentName[] = deterministicAgents;
        let planTasks: any[] = [];
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
              if (validation.data.plan) {
                planTasks = validation.data.plan;
              }
            }
          }
        } catch (err) {
          console.warn(
            '[SupervisorNode] LLM call failed or omitted, using deterministic agent plan:',
            err,
          );
        }

        // PR-03: Reiteración dirigida estricta: en reiteración se ejecutan ÚNICAMENTE los agentes requeridos
        if (isReiteration && requestedAgents && requestedAgents.length > 0) {
          selectedAgents = requestedAgents;
        } else {
          // En primera ronda se forzan los agentes clasificados determinísticamente
          selectedAgents = deterministicAgents;
        }

        if (planTasks.length === 0) {
          planTasks = selectedAgents.map((ag) => ({
            agentName: ag,
            objective: `Ejecutar análisis especializado de ${ag} para el scope asignado.`,
          }));
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
          analysisScope,
          scopeHash: analysisScope.scopeHash,
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
            analysisScope,
          },
          inputTokens,
          outputTokens,
        };
      },
    });

    return {
      activeAgents: result.selectedAgents,
      investigationPlan: result.tasks,
      analysisScope: result.analysisScope,
      filters: {
        dateFrom: result.analysisScope.dateFrom,
        dateTo: result.analysisScope.dateTo,
        categories: result.analysisScope.categories,
        sellerIds: result.analysisScope.sellerIds,
        customerStates: result.analysisScope.customerStates,
      },
      agentRunTraces: [agentTrace],
    };
  };
}
