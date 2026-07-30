import { ChatOpenAI } from '@langchain/openai';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';
import { createSellerPerformanceTools } from './seller.tools';
import { runAgentWithTrace, executeToolWithTrace } from '../../observability/agent-runner';
import { extractModelUsage } from '../../observability/usage';
import { ToolExecutionTrace } from '@commerce-ops/shared-types';

export function createSellerPerformanceNode(
  prisma: PrismaService,
  streaming: StreamingService,
) {
  return async (state: CommerceOpsStateType) => {
    const { investigationId, userQuestion } = state;
    const iteration = state.iteration || 1;
    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    streaming.emit(investigationId, 'agent.started', { agent: 'SELLER_PERFORMANCE' });

    const tools = createSellerPerformanceTools(prisma);
    const scorecardTool = tools.find((t) => t.name === 'get_seller_scorecard')!;

    let targetSellerId = state.filters.sellerIds?.[0];
    if (!targetSellerId) {
      const topSeller = await prisma.olistOrderItem.groupBy({
        by: ['sellerId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 1,
      });
      targetSellerId = topSeller[0]?.sellerId || 'seller-sample';
    }

    const { result, trace: agentTrace } = await runAgentWithTrace({
      agentName: 'SELLER_PERFORMANCE',
      iteration,
      modelName,
      execute: async ({ localRunId }) => {
        const toolTraces: ToolExecutionTrace[] = [];
        const scorecardParams = { sellerId: targetSellerId };

        streaming.emit(investigationId, 'tool.started', { agent: 'SELLER_PERFORMANCE', tool: 'get_seller_scorecard' });

        const { result: scorecardResult, trace: scorecardTrace } = await executeToolWithTrace({
          localAgentRunId: localRunId,
          agentName: 'SELLER_PERFORMANCE',
          iteration,
          toolName: 'get_seller_scorecard',
          parameters: scorecardParams,
          execute: () => scorecardTool.invoke(scorecardParams),
        });
        toolTraces.push(scorecardTrace);
        streaming.emit(investigationId, 'tool.completed', { agent: 'SELLER_PERFORMANCE', tool: 'get_seller_scorecard' });

        const evidenceItem = {
          id: `ev-seller-${Date.now()}`,
          localAgentRunId: localRunId,
          localToolExecutionId: scorecardTrace.localExecutionId,
          sourceType: 'TOOL_EXECUTION' as const,
          agentName: 'SELLER_PERFORMANCE' as const,
          iteration,
          toolName: 'get_seller_scorecard',
          parameters: scorecardParams,
          resultSummary: scorecardResult,
          generatedAt: new Date().toISOString(),
        };

        const model = new ChatOpenAI({
          modelName,
          temperature: 0.2,
          apiKey: process.env.OPENAI_API_KEY,
        });

        const prompt = `Eres el Seller Performance Agent de CommerceOps AI.
Pregunta del usuario: "${userQuestion}"

Scorecard del vendedor analizado:
${scorecardResult}

Genera un hallazgo de evaluación de riesgo en formato JSON:
{
  "title": "Evaluación de riesgo operacional del vendedor",
  "description": "Análisis cuantitativo de entregas a tiempo, facturación y calificaciones acumuladas.",
  "confidence": 0.91,
  "findingType": "SELLER_RISK"
}`;

        let title = 'Ficha de rendimiento de vendedor evaluada';
        let description = 'Se analizó el desempeño operativo del vendedor.';
        let confidence = 0.91;
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
          console.warn('[SellerNode] Error executing LLM call:', err);
        }

        const findingItem = {
          id: `finding-seller-${Date.now()}`,
          investigationId,
          localAgentRunId: localRunId,
          agent: 'SELLER_PERFORMANCE' as const,
          title,
          description,
          findingType: 'SELLER_RISK',
          confidence,
          evidenceIds: [evidenceItem.id],
          operationalStatus: 'ACTIONABLE' as const,
          createdAt: new Date().toISOString(),
        };

        streaming.emit(investigationId, 'finding.created', { agent: 'SELLER_PERFORMANCE', finding: findingItem });
        streaming.emit(investigationId, 'agent.completed', { agent: 'SELLER_PERFORMANCE' });

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
      completedAgents: [...state.completedAgents, 'SELLER_PERFORMANCE' as const],
      agentRunTraces: [agentTrace],
      toolExecutionTraces: result.toolTraces,
      findings: [result.finding],
      evidence: result.evidence,
    };
  };
}
