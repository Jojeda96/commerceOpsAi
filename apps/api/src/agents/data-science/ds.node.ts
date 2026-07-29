import { ChatOpenAI } from '@langchain/openai';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { StreamingService } from '../../streaming/streaming.service';
import { createDataScienceTools } from './ds.tools';

export function createDataScienceNode(streaming: StreamingService) {
  return async (state: CommerceOpsStateType) => {
    const { investigationId, userQuestion } = state;

    streaming.emit(investigationId, 'agent.started', { agent: 'DATA_SCIENCE' });

    const tools = createDataScienceTools();
    const predictTool = tools.find((t) => t.name === 'predict_delivery_delay')!;

    streaming.emit(investigationId, 'tool.started', {
      agent: 'DATA_SCIENCE',
      tool: 'predict_delivery_delay',
    });
    const filters = state.filters || {};
    const predictResult = await predictTool.invoke({
      sellerState: filters.customerStates?.[0] || 'SP',
      customerState: filters.customerStates?.[1] || 'RJ',
      freightValue: 45,
      itemCount: 2,
    });
    streaming.emit(investigationId, 'tool.completed', {
      agent: 'DATA_SCIENCE',
      tool: 'predict_delivery_delay',
    });

    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `Eres el Data Science Agent de CommerceOps AI.
Pregunta del usuario: "${userQuestion}"

Resultado del modelo predictivo (baseline heurístico):
${predictResult}

Genera un hallazgo técnico explicable en JSON:
{
  "title": "Estimación de riesgo de retraso (Baseline Heurístico)",
  "description": "Explicación basada en la probabilidad calculada y factores de riesgo.",
  "confidence": 0.85,
  "findingType": "ML_PREDICTION"
}`;

    let title = 'Modelo predictivo / baseline de atrasos ejecutado';
    let description =
      'Se evaluó la probabilidad de retraso mediante heurística baseline.';
    let confidence = 0.85;

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
      console.warn('[DSNode] Error in LLM call:', err);
    }

    const evidenceId = `ev-ds-${Date.now()}`;
    const evidenceItem = {
      id: evidenceId,
      toolName: 'predict_delivery_delay',
      parameters: { modelVersion: 'delay-heuristic-v1' },
      resultSummary: predictResult,
      generatedAt: new Date().toISOString(),
    };

    const findingItem = {
      id: `finding-ds-${Date.now()}`,
      investigationId,
      agent: 'DATA_SCIENCE' as const,
      title,
      description,
      findingType: 'ML_PREDICTION',
      confidence,
      evidenceIds: [evidenceId],
      createdAt: new Date().toISOString(),
    };

    streaming.emit(investigationId, 'finding.created', {
      agent: 'DATA_SCIENCE',
      finding: findingItem,
    });
    streaming.emit(investigationId, 'agent.completed', {
      agent: 'DATA_SCIENCE',
    });

    return {
      completedAgents: [...state.completedAgents, 'DATA_SCIENCE' as const],
      findings: [findingItem],
      evidence: [evidenceItem],
    };
  };
}
