import { ChatOpenAI } from '@langchain/openai';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';
import { createLogisticsTools } from './logistics.tools';
import { runAgentWithTrace, executeToolWithTrace } from '../../observability/agent-runner';
import { extractModelUsage } from '../../observability/usage';
import { ToolExecutionTrace } from '@commerce-ops/shared-types';

export function createLogisticsNode(
  prisma: PrismaService,
  streaming: StreamingService,
) {
  return async (state: CommerceOpsStateType) => {
    const { investigationId, userQuestion } = state;
    const iteration = state.iteration || 1;
    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    streaming.emit(investigationId, 'agent.started', { agent: 'LOGISTICS' });

    const tools = createLogisticsTools(prisma);
    const delTool = tools.find((t) => t.name === 'get_delivery_summary')!;
    const routeTool = tools.find((t) => t.name === 'get_delivery_performance_by_route')!;
    const stageTool = tools.find((t) => t.name === 'get_delivery_stage_breakdown')!;

    const isRouteQuestion = /ruta|interestatal|regi[oó]n|estado/i.test(userQuestion);

    const { result, trace: agentTrace } = await runAgentWithTrace({
      agentName: 'LOGISTICS',
      iteration,
      modelName,
      execute: async ({ localRunId }) => {
        const toolTraces: ToolExecutionTrace[] = [];
        const evidenceItems: any[] = [];

        const delParams = { dateFrom: state.filters.dateFrom, dateTo: state.filters.dateTo };
        streaming.emit(investigationId, 'tool.started', { agent: 'LOGISTICS', tool: 'get_delivery_summary' });

        const { result: delResult, trace: delTrace } = await executeToolWithTrace({
          localAgentRunId: localRunId,
          agentName: 'LOGISTICS',
          iteration,
          toolName: 'get_delivery_summary',
          parameters: delParams,
          execute: () => delTool.invoke(delParams),
        });
        toolTraces.push(delTrace);
        streaming.emit(investigationId, 'tool.completed', { agent: 'LOGISTICS', tool: 'get_delivery_summary' });

        let routeResult = '';
        let stageResult = '';
        if (isRouteQuestion) {
          streaming.emit(investigationId, 'tool.started', { agent: 'LOGISTICS', tool: 'get_delivery_performance_by_route' });
          const { result: rRes, trace: rTrace } = await executeToolWithTrace({
            localAgentRunId: localRunId,
            agentName: 'LOGISTICS',
            iteration,
            toolName: 'get_delivery_performance_by_route',
            parameters: { topN: 10 },
            execute: () => routeTool.invoke({ topN: 10 }),
          });
          routeResult = rRes;
          toolTraces.push(rTrace);
          streaming.emit(investigationId, 'tool.completed', { agent: 'LOGISTICS', tool: 'get_delivery_performance_by_route' });

          streaming.emit(investigationId, 'tool.started', { agent: 'LOGISTICS', tool: 'get_delivery_stage_breakdown' });
          const { result: sRes, trace: sTrace } = await executeToolWithTrace({
            localAgentRunId: localRunId,
            agentName: 'LOGISTICS',
            iteration,
            toolName: 'get_delivery_stage_breakdown',
            parameters: delParams,
            execute: () => stageTool.invoke(delParams),
          });
          stageResult = sRes;
          toolTraces.push(sTrace);
          streaming.emit(investigationId, 'tool.completed', { agent: 'LOGISTICS', tool: 'get_delivery_stage_breakdown' });
        }

        const primaryToolTrace = isRouteQuestion && toolTraces.length > 1 ? toolTraces[1] : delTrace;

        evidenceItems.push({
          id: `ev-logistics-${Date.now()}`,
          localAgentRunId: localRunId,
          localToolExecutionId: primaryToolTrace.localExecutionId,
          sourceType: 'TOOL_EXECUTION' as const,
          agentName: 'LOGISTICS' as const,
          iteration,
          toolName: primaryToolTrace.toolName,
          parameters: delParams,
          resultSummary: isRouteQuestion
            ? `Resumen: ${delResult} | Rutas: ${routeResult} | Etapas: ${stageResult}`
            : delResult,
          generatedAt: new Date().toISOString(),
        });

        const model = new ChatOpenAI({
          modelName,
          temperature: 0.1,
          apiKey: process.env.OPENAI_API_KEY,
        });

        const prompt = `Eres el Logistics Agent de CommerceOps AI.
Pregunta del usuario: "${userQuestion}"

Métricas deterministas de logística global:
${delResult}

${isRouteQuestion ? `Rendimiento de entregas por ruta (sellerState -> customerState):\n${routeResult}\nDesglose de etapas (preparación vs tránsito):\n${stageResult}` : ''}

REGLAS DE RIGOR METODOLÓGICO Y CERO ALUCINACIÓN:
1. Basar las conclusiones ÚNICAMENTE en las cifras cuantitativas anteriores.
2. PROHIBIDO mencionar o inventar factores no registrados en el dataset de Olist (por ejemplo: clima, condiciones climáticas, tráfico, huelgas, camiones o carga de trabajo de transportistas).
3. PROHIBIDO mencionar "factores SHAP" o "SHAP values"; las atribuciones SHAP corresponden exclusivamente al Data Science Agent.
4. Si la consulta se refiere a envíos interestatales, utiliza los datos de la herramienta de rutas (sellerState != customerState), no las métricas globales como si fueran interestatales.

Genera un hallazgo técnico objetivo en formato JSON:
{
  "title": "Título del hallazgo de logística",
  "description": "Descripción cuantitativa detallada basándose exclusivamente en los datos de las herramientas.",
  "confidence": 0.92,
  "findingType": "LOGISTICS_DELAY"
}`;

        let title = 'Análisis de comportamiento logístico completado';
        let description = 'Se evaluó la tasa de entregas a tiempo y días promedio de transporte.';
        let confidence = 0.92;
        let inputTokens: number | undefined;
        let outputTokens: number | undefined;

        try {
          const response = await model.invoke(prompt);
          const usage = extractModelUsage(response);
          inputTokens = usage.inputTokens;
          outputTokens = usage.outputTokens;

          const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
          const match = content.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.title) title = parsed.title;
            if (parsed.description) description = parsed.description;
            if (parsed.confidence) confidence = parsed.confidence;
          }
        } catch (err) {
          console.warn('[LogisticsNode] Error calling LLM:', err);
        }

        const findingItem = {
          id: `finding-logistics-${Date.now()}`,
          investigationId,
          localAgentRunId: localRunId,
          agent: 'LOGISTICS' as const,
          title,
          description,
          findingType: 'LOGISTICS_DELAY',
          confidence,
          evidenceIds: evidenceItems.map((e) => e.id),
          operationalStatus: 'ACTIONABLE' as const,
          createdAt: new Date().toISOString(),
        };

        streaming.emit(investigationId, 'finding.created', { agent: 'LOGISTICS', finding: findingItem });
        streaming.emit(investigationId, 'agent.completed', { agent: 'LOGISTICS' });

        return {
          result: {
            finding: findingItem,
            evidence: evidenceItems,
            toolTraces,
          },
          inputTokens,
          outputTokens,
        };
      },
    });

    return {
      completedAgents: [...state.completedAgents, 'LOGISTICS' as const],
      agentRunTraces: [agentTrace],
      toolExecutionTraces: result.toolTraces,
      findings: [result.finding],
      evidence: result.evidence,
    };
  };
}
