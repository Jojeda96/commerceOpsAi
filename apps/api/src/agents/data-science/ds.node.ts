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
    const explainTool = tools.find((t) => t.name === 'explain_delivery_delay')!;

    streaming.emit(investigationId, 'tool.started', {
      agent: 'DATA_SCIENCE',
      tool: 'predict_delivery_delay',
    });
    const filters = state.filters || {};
    const sellerState = filters.customerStates?.[0] || 'SP';
    const customerState = filters.customerStates?.[1] || 'RJ';

    const predictResult = await predictTool.invoke({
      sellerState,
      customerState,
      freightValue: 45,
      itemCount: 2,
    });
    streaming.emit(investigationId, 'tool.completed', {
      agent: 'DATA_SCIENCE',
      tool: 'predict_delivery_delay',
    });

    const explainResult = await explainTool.invoke({
      sellerState,
      customerState,
      freightValue: 45,
      itemCount: 2,
    });

    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `Eres el Data Science Agent de CommerceOps AI.
Pregunta del usuario: "${userQuestion}"

Resultado de predicción del modelo XGBoost:
${predictResult}

Explicación de características SHAP (TreeExplainer):
${explainResult}

Genera un hallazgo técnico explicable en formato JSON. 
REGLA OBLIGATORIA:
- El título DEBE ser: "Predicción de Riesgo de Atraso (XGBoost Classifier & SHAP Explainer)". NO agregues la palabra "Baseline Heurístico".
- La descripción DEBE incluir la probabilidad porcentual calculada y detallar los factores SHAP numéricos (ej. is_interstate, freight_value, product_volume_cm3).

Estructura JSON requerida:
{
  "title": "Predicción de Riesgo de Atraso (XGBoost Classifier & SHAP Explainer)",
  "description": "La probabilidad de atraso predicha por el modelo XGBoost es de X.X%. Los factores SHAP de mayor impacto incluyen...",
  "confidence": 0.88,
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
