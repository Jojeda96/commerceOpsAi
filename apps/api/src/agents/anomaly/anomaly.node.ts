import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';
import { createAnomalyTools } from './anomaly.tools';
import {
  runAgentWithTrace,
  executeToolWithTrace,
} from '../../observability/agent-runner';
import { ToolExecutionTrace, Evidence } from '@commerce-ops/shared-types';
import { buildToolScope } from '../scope/build-tool-scope';
import { buildAnomalyFinding } from './build-anomaly-finding';
import { AnomalyResultSchema } from './anomaly-result.schema';

export function createAnomalyNode(
  prisma: PrismaService,
  streaming: StreamingService,
) {
  return async (state: CommerceOpsStateType) => {
    const { investigationId } = state;
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

        let parsedResult: any = {};
        try {
          const jsonParsed =
            typeof anomalyResult === 'string'
              ? JSON.parse(anomalyResult)
              : anomalyResult;
          parsedResult = AnomalyResultSchema.parse(jsonParsed);
        } catch (err) {
          console.warn(
            '[AnomalyNode] Error or fallback parsing anomaly tool result:',
            err,
          );
          if (typeof anomalyResult === 'string') {
            try {
              parsedResult = JSON.parse(anomalyResult);
            } catch (e) {
              parsedResult = {};
            }
          }
        }

        const evidenceItem: Evidence = {
          id: `ev-anomaly-${Date.now()}`,
          localAgentRunId: localRunId,
          localToolExecutionId: anomalyTrace.localExecutionId,
          sourceType: 'TOOL_EXECUTION' as const,
          agentName: 'ANOMALY' as const,
          iteration,
          toolName: 'detect_metric_anomalies',
          parameters: anomalyParams,
          resultSummary:
            typeof anomalyResult === 'string'
              ? anomalyResult
              : JSON.stringify(anomalyResult),
          status: parsedResult.status || 'AVAILABLE',
          reasonCode: parsedResult.reasonCode,
          scopeHash: parsedResult.scopeHash || state.analysisScope?.scopeHash,
          appliedScope: parsedResult.appliedScope || state.analysisScope,
          rowCount: parsedResult.rowCount,
          sampleSize: parsedResult.sampleSize,
          metrics: parsedResult.metrics || [],
          generatedAt: new Date().toISOString(),
        };

        const findingItem = buildAnomalyFinding({
          investigationId,
          localAgentRunId: localRunId,
          evidence: evidenceItem,
        });

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
