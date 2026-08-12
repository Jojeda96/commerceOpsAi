import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';
import { createSalesTools } from './sales.tools';
import {
  runAgentWithTrace,
  executeToolWithTrace,
} from '../../observability/agent-runner';
import { ToolExecutionTrace, Evidence } from '@commerce-ops/shared-types';
import { buildSalesFinding } from './build-sales-finding';

export function createSalesNode(
  prisma: PrismaService,
  streaming: StreamingService,
) {
  return async (state: CommerceOpsStateType) => {
    const {
      investigationId,
      userQuestion,
      requiredAnswerComponents = [],
    } = state;
    const iteration = state.iteration || 1;
    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    streaming.emit(investigationId, 'agent.started', { agent: 'SALES' });

    const tools = createSalesTools(prisma);
    const revCatTool = tools.find((t) => t.name === 'get_sales_by_category')!;
    const paymentTool = tools.find(
      (t) => t.name === 'get_sales_by_payment_method',
    )!;

    const isCategoryQuery =
      requiredAnswerComponents.includes('TOP_REVENUE_CATEGORIES') ||
      /categor[ií]a/i.test(userQuestion);
    const isPaymentQuery =
      requiredAnswerComponents.includes('PAYMENT_METHOD_COMPARISON') ||
      /pago|tarjeta|boleto/i.test(userQuestion);

    const { result, trace: agentTrace } = await runAgentWithTrace({
      agentName: 'SALES',
      iteration,
      modelName,
      execute: async ({ localRunId }) => {
        const toolTraces: ToolExecutionTrace[] = [];
        const evidenceItems: Evidence[] = [];

        const scopeHash = state.analysisScope?.scopeHash || 'global-scope';

        let categoryEvidence: Evidence | undefined;
        let paymentEvidence: Evidence | undefined;

        if (isCategoryQuery || (!isPaymentQuery && !isCategoryQuery)) {
          const revCatParams = {
            dateFrom: state.analysisScope?.dateFrom,
            dateTo: state.analysisScope?.dateTo,
            topN: 5,
            scopeHash,
          };
          streaming.emit(investigationId, 'tool.started', {
            agent: 'SALES',
            tool: 'get_sales_by_category',
          });

          const { result: revCatResult, trace: revCatTrace } =
            await executeToolWithTrace({
              localAgentRunId: localRunId,
              agentName: 'SALES',
              iteration,
              toolName: 'get_sales_by_category',
              parameters: revCatParams,
              execute: () => revCatTool.invoke(revCatParams),
            });
          toolTraces.push(revCatTrace);
          streaming.emit(investigationId, 'tool.completed', {
            agent: 'SALES',
            tool: 'get_sales_by_category',
          });

          const revCatResultStr =
            typeof revCatResult === 'string'
              ? revCatResult
              : JSON.stringify(revCatResult);

          const parsedCategoryEnvelope = JSON.parse(revCatResultStr);

          categoryEvidence = {
            id: `ev-sales-category-${Date.now()}`,
            localAgentRunId: localRunId,
            localToolExecutionId: revCatTrace.localExecutionId,
            sourceType: 'TOOL_EXECUTION',
            agentName: 'SALES',
            iteration,
            toolName: 'get_sales_by_category',
            scopeHash,
            appliedScope: state.analysisScope,
            status: parsedCategoryEnvelope.status,
            reasonCode: parsedCategoryEnvelope.reasonCode,
            parameters: revCatParams,
            resultSummary: revCatResultStr,
            rowCount: parsedCategoryEnvelope.rowCount || 0,
            sampleSize: parsedCategoryEnvelope.sampleSize || 0,
            metrics: parsedCategoryEnvelope.metrics || [],
            generatedAt: new Date().toISOString(),
          };
          evidenceItems.push(categoryEvidence);
        }

        if (isPaymentQuery) {
          const paymentParams = {
            dateFrom: state.analysisScope?.dateFrom,
            dateTo: state.analysisScope?.dateTo,
            scopeHash,
          };
          streaming.emit(investigationId, 'tool.started', {
            agent: 'SALES',
            tool: 'get_sales_by_payment_method',
          });

          const { result: pRes, trace: paymentTrace } =
            await executeToolWithTrace({
              localAgentRunId: localRunId,
              agentName: 'SALES',
              iteration,
              toolName: 'get_sales_by_payment_method',
              parameters: paymentParams,
              execute: () => paymentTool.invoke(paymentParams),
            });
          toolTraces.push(paymentTrace);
          streaming.emit(investigationId, 'tool.completed', {
            agent: 'SALES',
            tool: 'get_sales_by_payment_method',
          });

          const paymentResultStr =
            typeof pRes === 'string' ? pRes : JSON.stringify(pRes);

          const parsedPaymentEnvelope = JSON.parse(paymentResultStr);

          paymentEvidence = {
            id: `ev-sales-payment-${Date.now()}`,
            localAgentRunId: localRunId,
            localToolExecutionId: paymentTrace.localExecutionId,
            sourceType: 'TOOL_EXECUTION',
            agentName: 'SALES',
            iteration,
            toolName: 'get_sales_by_payment_method',
            scopeHash,
            appliedScope: state.analysisScope,
            status: parsedPaymentEnvelope.status,
            reasonCode: parsedPaymentEnvelope.reasonCode,
            parameters: paymentParams,
            resultSummary: paymentResultStr,
            rowCount: parsedPaymentEnvelope.rowCount || 0,
            sampleSize: parsedPaymentEnvelope.sampleSize || 0,
            metrics: parsedPaymentEnvelope.metrics || [],
            generatedAt: new Date().toISOString(),
          };
          evidenceItems.push(paymentEvidence);
        }

        const { finding, coverageItems } = buildSalesFinding({
          investigationId,
          localAgentRunId: localRunId,
          userQuestion,
          requiredComponents: requiredAnswerComponents,
          categoryEvidence,
          paymentEvidence,
        });

        streaming.emit(investigationId, 'finding.created', {
          agent: 'SALES',
          finding,
        });
        streaming.emit(investigationId, 'agent.completed', { agent: 'SALES' });

        return {
          result: {
            finding,
            evidence: evidenceItems,
            toolTraces,
            coverageItems,
          },
        };
      },
    });

    return {
      completedAgents: [...state.completedAgents, 'SALES' as const],
      agentRunTraces: [agentTrace],
      toolExecutionTraces: result.toolTraces,
      findings: [result.finding],
      evidence: result.evidence,
      answerCoverage: result.coverageItems,
    };
  };
}
