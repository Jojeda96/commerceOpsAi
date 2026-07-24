import { ChatOpenAI } from '@langchain/openai';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';
import { createSellerPerformanceTools } from './seller.tools';

export function createSellerPerformanceNode(prisma: PrismaService, streaming: StreamingService) {
  return async (state: CommerceOpsStateType) => {
    const { investigationId, userQuestion } = state;

    streaming.emit(investigationId, 'agent.started', { agent: 'SELLER_PERFORMANCE' });

    const tools = createSellerPerformanceTools(prisma);
    const scorecardTool = tools.find((t) => t.name === 'get_seller_scorecard')!;

    // Si hay un sellerId en los filtros se usa, de lo contrario se busca el primer seller top
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

    streaming.emit(investigationId, 'tool.started', { agent: 'SELLER_PERFORMANCE', tool: 'get_seller_scorecard' });
    const scorecardResult = await scorecardTool.invoke({ sellerId: targetSellerId });
    streaming.emit(investigationId, 'tool.completed', { agent: 'SELLER_PERFORMANCE', tool: 'get_seller_scorecard' });

    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
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

    try {
      const response = await model.invoke(prompt);
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

    const evidenceId = `ev-seller-${Date.now()}`;
    const evidenceItem = {
      id: evidenceId,
      toolName: 'get_seller_scorecard',
      parameters: { sellerId: targetSellerId },
      resultSummary: scorecardResult,
      generatedAt: new Date().toISOString(),
    };

    const findingItem = {
      id: `finding-seller-${Date.now()}`,
      investigationId,
      agent: 'SELLER_PERFORMANCE' as const,
      title,
      description,
      findingType: 'SELLER_RISK',
      confidence,
      evidenceIds: [evidenceId],
      createdAt: new Date().toISOString(),
    };

    streaming.emit(investigationId, 'finding.created', { agent: 'SELLER_PERFORMANCE', finding: findingItem });
    streaming.emit(investigationId, 'agent.completed', { agent: 'SELLER_PERFORMANCE' });

    return {
      completedAgents: [...state.completedAgents, 'SELLER_PERFORMANCE' as const],
      findings: [findingItem],
      evidence: [evidenceItem],
    };
  };
}
