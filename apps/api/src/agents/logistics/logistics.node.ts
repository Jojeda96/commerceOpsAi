import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';
import { createLogisticsTools } from './logistics.tools';
import {
  runAgentWithTrace,
  executeToolWithTrace,
} from '../../observability/agent-runner';
import {
  ToolExecutionTrace,
  Evidence,
  EvidenceMetric,
} from '@commerce-ops/shared-types';
import { buildToolScope } from '../scope/build-tool-scope';
import { buildLogisticsFinding } from './build-logistics-finding';

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
    const delTool = tools.getDeliverySummary;
    const routeTool = tools.getDeliveryPerformanceByRoute;
    const stageTool = tools.getDeliveryStageBreakdown;

    const isRouteQuestion = /ruta|interestatal|regi[oó]n|estado/i.test(
      userQuestion,
    );

    const { result, trace: agentTrace } = await runAgentWithTrace({
      agentName: 'LOGISTICS',
      iteration,
      investigationId,
      modelName,
      execute: async ({ localRunId }) => {
        const toolTraces: ToolExecutionTrace[] = [];
        const evidenceItems: Evidence[] = [];

        const commonScope = buildToolScope(state.analysisScope);

        // 1. Summary tool
        streaming.emit(investigationId, 'tool.started', {
          agent: 'LOGISTICS',
          tool: 'get_delivery_summary',
        });

        const { result: delResultRes, trace: delTrace } =
          await executeToolWithTrace({
            localAgentRunId: localRunId,
            agentName: 'LOGISTICS',
            iteration,
            toolName: 'get_delivery_summary',
            parameters: commonScope,
            execute: () => delTool.invoke(commonScope),
          });
        toolTraces.push(delTrace);
        streaming.emit(investigationId, 'tool.completed', {
          agent: 'LOGISTICS',
          tool: 'get_delivery_summary',
        });

        const delResultStr =
          typeof delResultRes === 'string'
            ? delResultRes
            : JSON.stringify(delResultRes);
        const parsedDel = JSON.parse(delResultStr);
        const aggregateEvidenceId = `ev-logistics-summary-${Date.now()}`;
        const summaryEvidence: Evidence = {
          id: aggregateEvidenceId,
          toolExecutionId: delTrace.localExecutionId,
          localAgentRunId: localRunId,
          localToolExecutionId: delTrace.localExecutionId,
          sourceType: 'TOOL_EXECUTION',
          agentName: 'LOGISTICS',
          iteration,
          toolName: 'get_delivery_summary',
          scopeHash: commonScope.scopeHash,
          appliedScope: state.analysisScope,
          status: parsedDel.status,
          reasonCode: parsedDel.reasonCode,
          parameters: commonScope,
          resultSummary: delResultStr,
          rowCount: parsedDel.rowCount || 0,
          sampleSize: parsedDel.sampleSize || 0,
          metrics: (parsedDel.metrics || []) as EvidenceMetric[],
          generatedAt: new Date().toISOString(),
        };
        evidenceItems.push(summaryEvidence);

        let routeEvidence: Evidence | undefined;
        let stageEvidence: Evidence | undefined;

        if (isRouteQuestion) {
          // 2. Route tool
          const routeParams = {
            ...commonScope,
            minOrders: 10,
            topN: 10,
          };
          streaming.emit(investigationId, 'tool.started', {
            agent: 'LOGISTICS',
            tool: 'get_delivery_performance_by_route',
          });
          const { result: routeResultRes, trace: rTrace } =
            await executeToolWithTrace({
              localAgentRunId: localRunId,
              agentName: 'LOGISTICS',
              iteration,
              toolName: 'get_delivery_performance_by_route',
              parameters: routeParams,
              execute: () => routeTool.invoke(routeParams),
            });
          toolTraces.push(rTrace);
          streaming.emit(investigationId, 'tool.completed', {
            agent: 'LOGISTICS',
            tool: 'get_delivery_performance_by_route',
          });

          const routeResultStr =
            typeof routeResultRes === 'string'
              ? routeResultRes
              : JSON.stringify(routeResultRes);
          const parsedRoute = JSON.parse(routeResultStr);
          routeEvidence = {
            id: `ev-logistics-routes-${Date.now()}`,
            toolExecutionId: rTrace.localExecutionId,
            localAgentRunId: localRunId,
            localToolExecutionId: rTrace.localExecutionId,
            sourceType: 'TOOL_EXECUTION',
            agentName: 'LOGISTICS',
            iteration,
            toolName: 'get_delivery_performance_by_route',
            scopeHash: commonScope.scopeHash,
            appliedScope: state.analysisScope,
            status: parsedRoute.status,
            reasonCode: parsedRoute.reasonCode,
            parameters: routeParams,
            resultSummary: routeResultStr,
            rowCount: parsedRoute.rowCount || 0,
            sampleSize: parsedRoute.sampleSize || 0,
            metrics: (parsedRoute.metrics || []) as EvidenceMetric[],
            generatedAt: new Date().toISOString(),
          };
          evidenceItems.push(routeEvidence);

          // 3. Stage tool
          streaming.emit(investigationId, 'tool.started', {
            agent: 'LOGISTICS',
            tool: 'get_delivery_stage_breakdown',
          });
          const { result: stageResultRes, trace: sTrace } =
            await executeToolWithTrace({
              localAgentRunId: localRunId,
              agentName: 'LOGISTICS',
              iteration,
              toolName: 'get_delivery_stage_breakdown',
              parameters: commonScope,
              execute: () => stageTool.invoke(commonScope),
            });
          toolTraces.push(sTrace);
          streaming.emit(investigationId, 'tool.completed', {
            agent: 'LOGISTICS',
            tool: 'get_delivery_stage_breakdown',
          });

          const stageResultStr =
            typeof stageResultRes === 'string'
              ? stageResultRes
              : JSON.stringify(stageResultRes);
          const parsedStage = JSON.parse(stageResultStr);
          stageEvidence = {
            id: `ev-logistics-stage-${Date.now()}`,
            toolExecutionId: sTrace.localExecutionId,
            localAgentRunId: localRunId,
            localToolExecutionId: sTrace.localExecutionId,
            sourceType: 'TOOL_EXECUTION',
            agentName: 'LOGISTICS',
            iteration,
            toolName: 'get_delivery_stage_breakdown',
            scopeHash: commonScope.scopeHash,
            appliedScope: state.analysisScope,
            status: parsedStage.status,
            reasonCode: parsedStage.reasonCode,
            parameters: commonScope,
            resultSummary: stageResultStr,
            rowCount: parsedStage.rowCount || 0,
            sampleSize: parsedStage.sampleSize || 0,
            metrics: (parsedStage.metrics || []) as EvidenceMetric[],
            generatedAt: new Date().toISOString(),
          };
          evidenceItems.push(stageEvidence);
        }

        const findingItem = buildLogisticsFinding({
          investigationId,
          localAgentRunId: localRunId,
          userQuestion,
          scope: state.analysisScope,
          aggregateEvidence: summaryEvidence,
          routeEvidence,
          stageEvidence,
        });

        streaming.emit(investigationId, 'finding.created', {
          agent: 'LOGISTICS',
          finding: findingItem,
        });
        streaming.emit(investigationId, 'agent.completed', {
          agent: 'LOGISTICS',
        });

        return {
          result: {
            finding: findingItem,
            evidence: evidenceItems,
            toolTraces,
          },
          inputTokens: 0,
          outputTokens: 0,
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
