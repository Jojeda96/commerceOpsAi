import { ChatOpenAI } from '@langchain/openai';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';
import { createSalesTools } from './sales.tools';

export function createSalesNode(
  prisma: PrismaService,
  streaming: StreamingService,
) {
  return async (state: CommerceOpsStateType) => {
    const { investigationId, userQuestion } = state;

    streaming.emit(investigationId, 'agent.started', { agent: 'SALES' });

    const tools = createSalesTools(prisma);
    const revSummaryTool = tools.find((t) => t.name === 'get_revenue_summary')!;
    const revCatTool = tools.find((t) => t.name === 'get_sales_by_category')!;
    const paymentTool = tools.find((t) => t.name === 'get_sales_by_payment_method')!;
    const aovTrendTool = tools.find((t) => t.name === 'get_average_order_value_trend')!;

    const asksPayment = /pago|tarjeta|boleto|cuota|installments/i.test(userQuestion);
    const asksAov = /ticket promedio|aov|valor promedio|tendencia/i.test(userQuestion);

    streaming.emit(investigationId, 'tool.started', {
      agent: 'SALES',
      tool: 'get_revenue_summary',
    });
    const revSummaryResult = await revSummaryTool.invoke({
      dateFrom: state.filters.dateFrom,
      dateTo: state.filters.dateTo,
    });
    streaming.emit(investigationId, 'tool.completed', {
      agent: 'SALES',
      tool: 'get_revenue_summary',
    });

    streaming.emit(investigationId, 'tool.started', {
      agent: 'SALES',
      tool: 'get_sales_by_category',
    });
    const revCatResult = await revCatTool.invoke({
      dateFrom: state.filters.dateFrom,
      dateTo: state.filters.dateTo,
      topN: 5,
    });
    streaming.emit(investigationId, 'tool.completed', {
      agent: 'SALES',
      tool: 'get_sales_by_category',
    });

    let paymentResult: string | undefined;
    if (asksPayment) {
      streaming.emit(investigationId, 'tool.started', {
        agent: 'SALES',
        tool: 'get_sales_by_payment_method',
      });
      paymentResult = await paymentTool.invoke({
        dateFrom: state.filters.dateFrom,
        dateTo: state.filters.dateTo,
      });
      streaming.emit(investigationId, 'tool.completed', {
        agent: 'SALES',
        tool: 'get_sales_by_payment_method',
      });
    }

    let aovTrendResult: string | undefined;
    if (asksAov) {
      streaming.emit(investigationId, 'tool.started', {
        agent: 'SALES',
        tool: 'get_average_order_value_trend',
      });
      aovTrendResult = await aovTrendTool.invoke({
        dateFrom: state.filters.dateFrom,
        dateTo: state.filters.dateTo,
      });
      streaming.emit(investigationId, 'tool.completed', {
        agent: 'SALES',
        tool: 'get_average_order_value_trend',
      });
    }

    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
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

    try {
      const response = await model.invoke(prompt);
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
      console.warn('[SalesNode] Error in LLM call:', err);
    }

    const evidenceItems = [
      {
        id: `ev-sales-summary-${Date.now()}`,
        toolName: 'get_revenue_summary',
        parameters: { dateFrom: state.filters.dateFrom, dateTo: state.filters.dateTo },
        resultSummary: revSummaryResult,
        generatedAt: new Date().toISOString(),
      },
      {
        id: `ev-sales-category-${Date.now()}`,
        toolName: 'get_sales_by_category',
        parameters: { dateFrom: state.filters.dateFrom, dateTo: state.filters.dateTo, topN: 5 },
        resultSummary: revCatResult,
        generatedAt: new Date().toISOString(),
      },
    ];

    if (paymentResult) {
      evidenceItems.push({
        id: `ev-sales-payment-${Date.now()}`,
        toolName: 'get_sales_by_payment_method',
        parameters: { dateFrom: state.filters.dateFrom, dateTo: state.filters.dateTo },
        resultSummary: paymentResult,
        generatedAt: new Date().toISOString(),
      });
    }

    if (aovTrendResult) {
      evidenceItems.push({
        id: `ev-sales-aov-${Date.now()}`,
        toolName: 'get_average_order_value_trend',
        parameters: { dateFrom: state.filters.dateFrom, dateTo: state.filters.dateTo },
        resultSummary: aovTrendResult,
        generatedAt: new Date().toISOString(),
      });
    }

    const findingItem = {
      id: `finding-sales-${Date.now()}`,
      investigationId,
      agent: 'SALES' as const,
      title,
      description,
      findingType: 'SALES_TREND',
      confidence,
      evidenceIds: evidenceItems.map((e) => e.id),
      createdAt: new Date().toISOString(),
    };

    streaming.emit(investigationId, 'finding.created', {
      agent: 'SALES',
      finding: findingItem,
    });
    streaming.emit(investigationId, 'agent.completed', { agent: 'SALES' });

    return {
      completedAgents: [...state.completedAgents, 'SALES' as const],
      findings: [findingItem],
      evidence: evidenceItems,
    };
  };
}
