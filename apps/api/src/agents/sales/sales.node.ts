import { ChatOpenAI } from '@langchain/openai';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';
import { createSalesTools } from './sales.tools';
import { runAgentWithTrace, executeToolWithTrace } from '../../observability/agent-runner';
import { extractModelUsage } from '../../observability/usage';
import { ToolExecutionTrace } from '@commerce-ops/shared-types';

export function createSalesNode(
  prisma: PrismaService,
  streaming: StreamingService,
) {
  return async (state: CommerceOpsStateType) => {
    const { investigationId, userQuestion } = state;
    const iteration = state.iteration || 1;
    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    streaming.emit(investigationId, 'agent.started', { agent: 'SALES' });

    const tools = createSalesTools(prisma);
    const revSummaryTool = tools.find((t) => t.name === 'get_revenue_summary')!;
    const revCatTool = tools.find((t) => t.name === 'get_sales_by_category')!;
    const paymentTool = tools.find((t) => t.name === 'get_sales_by_payment_method')!;
    const aovTrendTool = tools.find((t) => t.name === 'get_average_order_value_trend')!;

    const asksPayment = /pago|tarjeta|boleto|cuota|installments/i.test(userQuestion);
    const asksAov = /ticket promedio|aov|valor promedio|tendencia/i.test(userQuestion);

    const { result, trace: agentTrace } = await runAgentWithTrace({
      agentName: 'SALES',
      iteration,
      modelName,
      execute: async ({ localRunId }) => {
        const toolTraces: ToolExecutionTrace[] = [];
        const evidenceItems: any[] = [];

        // Tool 1: Revenue Summary
        const revSummaryParams = { dateFrom: state.filters.dateFrom, dateTo: state.filters.dateTo };
        streaming.emit(investigationId, 'tool.started', { agent: 'SALES', tool: 'get_revenue_summary' });

        const { result: revSummaryResult, trace: revSummaryTrace } = await executeToolWithTrace({
          localAgentRunId: localRunId,
          agentName: 'SALES',
          iteration,
          toolName: 'get_revenue_summary',
          parameters: revSummaryParams,
          execute: () => revSummaryTool.invoke(revSummaryParams),
        });
        toolTraces.push(revSummaryTrace);
        streaming.emit(investigationId, 'tool.completed', { agent: 'SALES', tool: 'get_revenue_summary' });

        evidenceItems.push({
          id: `ev-sales-summary-${Date.now()}`,
          localAgentRunId: localRunId,
          localToolExecutionId: revSummaryTrace.localExecutionId,
          sourceType: 'TOOL_EXECUTION' as const,
          agentName: 'SALES' as const,
          iteration,
          toolName: 'get_revenue_summary',
          parameters: revSummaryParams,
          resultSummary: revSummaryResult,
          generatedAt: new Date().toISOString(),
        });

        // Tool 2: Sales by Category
        const revCatParams = { dateFrom: state.filters.dateFrom, dateTo: state.filters.dateTo, topN: 5 };
        streaming.emit(investigationId, 'tool.started', { agent: 'SALES', tool: 'get_sales_by_category' });

        const { result: revCatResult, trace: revCatTrace } = await executeToolWithTrace({
          localAgentRunId: localRunId,
          agentName: 'SALES',
          iteration,
          toolName: 'get_sales_by_category',
          parameters: revCatParams,
          execute: () => revCatTool.invoke(revCatParams),
        });
        toolTraces.push(revCatTrace);
        streaming.emit(investigationId, 'tool.completed', { agent: 'SALES', tool: 'get_sales_by_category' });

        evidenceItems.push({
          id: `ev-sales-category-${Date.now()}`,
          localAgentRunId: localRunId,
          localToolExecutionId: revCatTrace.localExecutionId,
          sourceType: 'TOOL_EXECUTION' as const,
          agentName: 'SALES' as const,
          iteration,
          toolName: 'get_sales_by_category',
          parameters: revCatParams,
          resultSummary: revCatResult,
          generatedAt: new Date().toISOString(),
        });

        // Tool 3: Payment Method (optional)
        let paymentResult: string | undefined;
        if (asksPayment) {
          const paymentParams = { dateFrom: state.filters.dateFrom, dateTo: state.filters.dateTo };
          streaming.emit(investigationId, 'tool.started', { agent: 'SALES', tool: 'get_sales_by_payment_method' });

          const { result: pRes, trace: paymentTrace } = await executeToolWithTrace({
            localAgentRunId: localRunId,
            agentName: 'SALES',
            iteration,
            toolName: 'get_sales_by_payment_method',
            parameters: paymentParams,
            execute: () => paymentTool.invoke(paymentParams),
          });
          paymentResult = pRes;
          toolTraces.push(paymentTrace);
          streaming.emit(investigationId, 'tool.completed', { agent: 'SALES', tool: 'get_sales_by_payment_method' });

          evidenceItems.push({
            id: `ev-sales-payment-${Date.now()}`,
            localAgentRunId: localRunId,
            localToolExecutionId: paymentTrace.localExecutionId,
            sourceType: 'TOOL_EXECUTION' as const,
            agentName: 'SALES' as const,
            iteration,
            toolName: 'get_sales_by_payment_method',
            parameters: paymentParams,
            resultSummary: paymentResult,
            generatedAt: new Date().toISOString(),
          });
        }

        // Tool 4: AOV Trend (optional)
        let aovTrendResult: string | undefined;
        if (asksAov) {
          const aovParams = { dateFrom: state.filters.dateFrom, dateTo: state.filters.dateTo };
          streaming.emit(investigationId, 'tool.started', { agent: 'SALES', tool: 'get_average_order_value_trend' });

          const { result: aovRes, trace: aovTrace } = await executeToolWithTrace({
            localAgentRunId: localRunId,
            agentName: 'SALES',
            iteration,
            toolName: 'get_average_order_value_trend',
            parameters: aovParams,
            execute: () => aovTrendTool.invoke(aovParams),
          });
          aovTrendResult = aovRes;
          toolTraces.push(aovTrace);
          streaming.emit(investigationId, 'tool.completed', { agent: 'SALES', tool: 'get_average_order_value_trend' });

          evidenceItems.push({
            id: `ev-sales-aov-${Date.now()}`,
            localAgentRunId: localRunId,
            localToolExecutionId: aovTrace.localExecutionId,
            sourceType: 'TOOL_EXECUTION' as const,
            agentName: 'SALES' as const,
            iteration,
            toolName: 'get_average_order_value_trend',
            parameters: aovParams,
            resultSummary: aovTrendResult,
            generatedAt: new Date().toISOString(),
          });
        }

        const model = new ChatOpenAI({
          modelName,
          temperature: 0.2,
          apiKey: process.env.OPENAI_API_KEY,
        });

        const prompt = `Eres el Sales Intelligence Agent de CommerceOps AI.
Pregunta del usuario: "${userQuestion}"

Resultados deterministas obtenidos de la base de datos:
- Resumen de ingresos: ${revSummaryResult}
- Ventas por categoría principales: ${revCatResult}
${paymentResult ? `- Desglose por métodos de pago: ${paymentResult}` : ''}
${aovTrendResult ? `- Tendencia de ticket promedio (AOV): ${aovTrendResult}` : ''}

Analiza estos datos y genera un hallazgo técnico claro en JSON con el siguiente formato:
{
  "title": "Título sintético del hallazgo de ventas",
  "description": "Descripción analítica basada estrictamente en los números presentados.",
  "confidence": 0.95,
  "findingType": "SALES_TREND"
}`;

        let title = 'Análisis de ventas e ingresos completado';
        let description = 'Se analizaron los totales de facturación y distribución por categoría.';
        let confidence = 0.95;
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
          console.warn('[SalesNode] Error in LLM call:', err);
        }

        const findingItem = {
          id: `finding-sales-${Date.now()}`,
          investigationId,
          localAgentRunId: localRunId,
          agent: 'SALES' as const,
          title,
          description,
          findingType: 'SALES_TREND',
          confidence,
          evidenceIds: evidenceItems.map((e) => e.id),
          operationalStatus: 'ACTIONABLE' as const,
          createdAt: new Date().toISOString(),
        };

        streaming.emit(investigationId, 'finding.created', { agent: 'SALES', finding: findingItem });
        streaming.emit(investigationId, 'agent.completed', { agent: 'SALES' });

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
      completedAgents: [...state.completedAgents, 'SALES' as const],
      agentRunTraces: [agentTrace],
      toolExecutionTraces: result.toolTraces,
      findings: [result.finding],
      evidence: result.evidence,
    };
  };
}
