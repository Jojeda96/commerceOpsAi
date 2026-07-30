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

    let modelVersionUsed = 'delay-heuristic-v1';
    let isFallback = true;
    try {
      const parsedPred = JSON.parse(predictResult);
      if (parsedPred.model_version) modelVersionUsed = parsedPred.model_version;
      if (parsedPred.modelVersion) modelVersionUsed = parsedPred.modelVersion;
      isFallback =
        modelVersionUsed.includes('heuristic') ||
        !!parsedPred.note?.includes('fallback');
    } catch (e) {
      console.warn('[DSNode] Could not parse predictResult JSON');
    }

    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `Eres el Data Science Agent de CommerceOps AI.
Pregunta del usuario: "${userQuestion}"

Resultado de predicción (${isFallback ? 'Baseline Heurístico (Fallback)' : 'XGBoost Classifier v1.1.0'}):
${predictResult}

Explicación de atribución de características (${isFallback ? 'Factores Heurísticos' : 'SHAP TreeExplainer'}):
${explainResult}

REGLAS DE RIGOR METODOLÓGICO Y CERO ALUCINACIÓN:
1. Describir la atribución de características SHAP ÚNICAMENTE para las variables presentes en la salida (is_interstate, freight_value, price, freight_ratio, product_weight_g, product_volume_cm3, purchase_dow, purchase_hour, item_count).
2. PROHIBIDO inventar o mencionar variables externas no registradas (como clima, condiciones climáticas, tráfico, huelga, camiones o carga de trabajo de transportistas).
3. Utilizar "atribución de características mediante SHAP" o "contribución del modelo", evitando afirmar "explicación causal".

Genera un hallazgo técnico explicable en formato JSON:
{
  "title": "Predicción de Riesgo de Atraso (${isFallback ? 'Baseline Heurístico' : 'XGBoost Classifier & SHAP Explainer'})",
  "description": "La probabilidad de atraso predicha es de X.X%. Los factores SHAP principales son...",
  "confidence": ${isFallback ? 0.75 : 0.88},
  "findingType": "ML_PREDICTION"
}`;

    let title = isFallback
      ? 'Predicción de Riesgo de Atraso (Baseline Heurístico)'
      : 'Predicción de Riesgo de Atraso (XGBoost Classifier & SHAP Explainer)';
    let description =
      'Se evaluó la probabilidad de retraso mediante el modelo predictivo.';
    let confidence = isFallback ? 0.75 : 0.88;

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
      parameters: { modelVersion: modelVersionUsed, isFallback },
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
