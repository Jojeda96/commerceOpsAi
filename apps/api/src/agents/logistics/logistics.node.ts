import { ChatOpenAI } from '@langchain/openai';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';
import { createLogisticsTools } from './logistics.tools';

export function createLogisticsNode(
  prisma: PrismaService,
  streaming: StreamingService,
) {
  return async (state: CommerceOpsStateType) => {
    const { investigationId, userQuestion } = state;

    streaming.emit(investigationId, 'agent.started', { agent: 'LOGISTICS' });

    const tools = createLogisticsTools(prisma);
    const delTool = tools.find((t) => t.name === 'get_delivery_summary')!;

    streaming.emit(investigationId, 'tool.started', {
      agent: 'LOGISTICS',
      tool: 'get_delivery_summary',
    });
    const delResult = await delTool.invoke({
      dateFrom: state.filters.dateFrom,
      dateTo: state.filters.dateTo,
    });
    streaming.emit(investigationId, 'tool.completed', {
      agent: 'LOGISTICS',
      tool: 'get_delivery_summary',
    });

    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `Eres el Logistics Agent de CommerceOps AI.
Pregunta del usuario: "${userQuestion}"

Métricas deterministas de logística calculadas:
${delResult}

Genera un hallazgo técnico objetivo en formato JSON:
{
  "title": "Título del hallazgo de logística",
  "description": "Descripción cuantitativa detallada sobre la tasa de atrasos y tiempos de transporte.",
  "confidence": 0.92,
  "findingType": "LOGISTICS_DELAY"
}`;

    let title = 'Análisis de comportamiento logístico completado';
    let description =
      'Se evaluó la tasa de entregas a tiempo y días promedio de transporte.';
    let confidence = 0.92;

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
      console.warn('[LogisticsNode] Error calling LLM:', err);
    }

    const evidenceId = `ev-logistics-${Date.now()}`;
    const evidenceItem = {
      id: evidenceId,
      toolName: 'get_delivery_summary',
      parameters: {
        dateFrom: state.filters.dateFrom,
        dateTo: state.filters.dateTo,
      },
      resultSummary: delResult,
      generatedAt: new Date().toISOString(),
    };

    const findingItem = {
      id: `finding-logistics-${Date.now()}`,
      investigationId,
      agent: 'LOGISTICS' as const,
      title,
      description,
      findingType: 'LOGISTICS_DELAY',
      confidence,
      evidenceIds: [evidenceId],
      createdAt: new Date().toISOString(),
    };

    streaming.emit(investigationId, 'finding.created', {
      agent: 'LOGISTICS',
      finding: findingItem,
    });
    streaming.emit(investigationId, 'agent.completed', { agent: 'LOGISTICS' });

    return {
      completedAgents: [...state.completedAgents, 'LOGISTICS' as const],
      findings: [findingItem],
      evidence: [evidenceItem],
    };
  };
}
