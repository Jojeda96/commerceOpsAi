import { ChatOpenAI } from '@langchain/openai';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';
import { createAnomalyTools } from './anomaly.tools';
import {
  runAgentWithTrace,
  executeToolWithTrace,
} from '../../observability/agent-runner';
import { extractModelUsage } from '../../observability/usage';
import { ToolExecutionTrace } from '@commerce-ops/shared-types';
import { buildToolScope } from '../scope/build-tool-scope';

export function createAnomalyNode(
  prisma: PrismaService,
  streaming: StreamingService,
) {
  return async (state: CommerceOpsStateType) => {
    const { investigationId, userQuestion } = state;
    const iteration = state.iteration || 1;
    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    streaming.emit(investigationId, 'agent.started', { agent: 'ANOMALY' });

    const tools = createAnomalyTools(prisma);
    const anomalyTool = tools.find(
      (t) => t.name === 'detect_metric_anomalies',
    )!;

    const { result, trace: agentTrace } = await runAgentWithTrace({
      agentName: 'ANOMALY',
      iteration,
      investigationId,
      modelName,
      execute: async ({ localRunId }) => {
        const toolTraces: ToolExecutionTrace[] = [];
        const commonScope = buildToolScope(state.analysisScope);
        const anomalyParams = {
          metric: 'late_delivery_rate' as const,
          threshold: 3.0,
          ...commonScope,
        };

        streaming.emit(investigationId, 'tool.started', {
          agent: 'ANOMALY',
          tool: 'detect_metric_anomalies',
        });

        const { result: anomalyResult, trace: anomalyTrace } =
          await executeToolWithTrace({
            localAgentRunId: localRunId,
            agentName: 'ANOMALY',
            iteration,
            toolName: 'detect_metric_anomalies',
            parameters: anomalyParams,
            execute: () => anomalyTool.invoke(anomalyParams),
          });
        toolTraces.push(anomalyTrace);
        streaming.emit(investigationId, 'tool.completed', {
          agent: 'ANOMALY',
          tool: 'detect_metric_anomalies',
        });

        const evidenceItem = {
          id: `ev-anomaly-${Date.now()}`,
          localAgentRunId: localRunId,
          localToolExecutionId: anomalyTrace.localExecutionId,
          sourceType: 'TOOL_EXECUTION' as const,
          agentName: 'ANOMALY' as const,
          iteration,
          toolName: 'detect_metric_anomalies',
          parameters: anomalyParams,
          resultSummary: anomalyResult,
          generatedAt: new Date().toISOString(),
        };

        const model = new ChatOpenAI({
          modelName,
          temperature: 0.2,
          apiKey: process.env.OPENAI_API_KEY,
        });

        const prompt = `Eres el Anomaly Detection Agent de CommerceOps AI.
Pregunta del usuario: "${userQuestion}"

Resultado del análisis de detección de anomalías:
${anomalyResult}

Genera un hallazgo técnico sobre anomalías en JSON:
{
  "title": "Detección de anomalías en tasa de retraso",
  "description": "Análisis mediante Z-Score robusto comparando valor observado vs rango esperado.",
  "confidence": 0.93,
  "findingType": "METRIC_ANOMALY"
}`;

        let title = 'Análisis de anomalías operacionales completado';
        let description =
          'Se evaluó la presencia de valores atípicos en la operación.';
        let confidence = 0.93;
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
            if (parsed.title) title = parsed.title;
            if (parsed.description) description = parsed.description;
            if (parsed.confidence) confidence = parsed.confidence;
          }
        } catch (err) {
          console.warn('[AnomalyNode] Error in LLM call:', err);
        }

        const findingItem = {
          id: `finding-anomaly-${Date.now()}`,
          investigationId,
          localAgentRunId: localRunId,
          agent: 'ANOMALY' as const,
          title,
          description,
          findingType: 'METRIC_ANOMALY',
          confidence,
          evidenceIds: [evidenceItem.id],
          operationalStatus: 'ACTIONABLE' as const,
          createdAt: new Date().toISOString(),
        };

        streaming.emit(investigationId, 'finding.created', {
          agent: 'ANOMALY',
          finding: findingItem,
        });
        streaming.emit(investigationId, 'agent.completed', {
          agent: 'ANOMALY',
        });

        return {
          result: {
            finding: findingItem,
            evidence: [evidenceItem],
            toolTraces,
          },
          inputTokens,
          outputTokens,
        };
      },
    });

    return {
      completedAgents: [...state.completedAgents, 'ANOMALY' as const],
      agentRunTraces: [agentTrace],
      toolExecutionTraces: result.toolTraces,
      findings: [result.finding],
      evidence: result.evidence,
    };
  };
}
