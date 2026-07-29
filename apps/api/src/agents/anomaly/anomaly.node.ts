import { ChatOpenAI } from '@langchain/openai';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { PrismaService } from '../../database/prisma.service';
import { StreamingService } from '../../streaming/streaming.service';
import { createAnomalyTools } from './anomaly.tools';

export function createAnomalyNode(
  prisma: PrismaService,
  streaming: StreamingService,
) {
  return async (state: CommerceOpsStateType) => {
    const { investigationId, userQuestion } = state;

    streaming.emit(investigationId, 'agent.started', { agent: 'ANOMALY' });

    const tools = createAnomalyTools(prisma);
    const anomalyTool = tools.find(
      (t) => t.name === 'detect_metric_anomalies',
    )!;

    streaming.emit(investigationId, 'tool.started', {
      agent: 'ANOMALY',
      tool: 'detect_metric_anomalies',
    });
    const anomalyResult = await anomalyTool.invoke({
      metric: 'late_delivery_rate',
      threshold: 3.0,
    });
    streaming.emit(investigationId, 'tool.completed', {
      agent: 'ANOMALY',
      tool: 'detect_metric_anomalies',
    });

    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
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
      console.warn('[AnomalyNode] Error in LLM call:', err);
    }

    const evidenceId = `ev-anomaly-${Date.now()}`;
    const evidenceItem = {
      id: evidenceId,
      toolName: 'detect_metric_anomalies',
      parameters: { threshold: 3.0 },
      resultSummary: anomalyResult,
      generatedAt: new Date().toISOString(),
    };

    const findingItem = {
      id: `finding-anomaly-${Date.now()}`,
      investigationId,
      agent: 'ANOMALY' as const,
      title,
      description,
      findingType: 'METRIC_ANOMALY',
      confidence,
      evidenceIds: [evidenceId],
      createdAt: new Date().toISOString(),
    };

    streaming.emit(investigationId, 'finding.created', {
      agent: 'ANOMALY',
      finding: findingItem,
    });
    streaming.emit(investigationId, 'agent.completed', { agent: 'ANOMALY' });

    return {
      completedAgents: [...state.completedAgents, 'ANOMALY' as const],
      findings: [findingItem],
      evidence: [evidenceItem],
    };
  };
}
