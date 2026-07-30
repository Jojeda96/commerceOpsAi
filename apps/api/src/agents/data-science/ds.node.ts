import { ChatOpenAI } from '@langchain/openai';
import { PrismaClient } from '@prisma/client';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { StreamingService } from '../../streaming/streaming.service';
import { createDataScienceTools, DeliveryScenario } from './ds.tools';

export type ModelReliability =
  | 'UNAVAILABLE'
  | 'LOW'
  | 'MODERATE'
  | 'APPROVED_FOR_DEMO';

export function deriveModelReliability(
  deploymentStatus: string,
  scenarioSampleSize: number,
): ModelReliability {
  if (deploymentStatus === 'UNAVAILABLE') return 'UNAVAILABLE';
  if (deploymentStatus !== 'APPROVED_FOR_DEMO_INFERENCE') return 'LOW';
  if (scenarioSampleSize < 100) return 'MODERATE';
  return 'APPROVED_FOR_DEMO';
}

export function reliabilityToConfidence(reliability: ModelReliability): number {
  switch (reliability) {
    case 'UNAVAILABLE':
      return 0.10;
    case 'LOW':
      return 0.30;
    case 'MODERATE':
      return 0.65;
    case 'APPROVED_FOR_DEMO':
      return 0.88;
  }
}

export function buildPredictionSummary(
  scenario: DeliveryScenario,
  prediction: any,
): string {
  const probPct = (prediction.probability * 100).toFixed(1);
  const threshPct = (prediction.threshold * 100).toFixed(1);
  return [
    `Escenario ${scenario.sellerState}→${scenario.customerState} (${scenario.primaryCategory || 'general'}).`,
    `Muestra histórica: ${scenario.sampleSize} pedidos.`,
    `Probabilidad estimada de atraso: ${probPct}%.`,
    `Threshold operativo: ${threshPct}%.`,
    `Nivel de riesgo: ${prediction.riskLevel || prediction.risk_level}.`,
    `Estado del modelo: ${prediction.deploymentStatus || prediction.deployment_status || 'EXPERIMENTAL_NOT_APPROVED'}.`,
    prediction.warning ? `Advertencia: ${prediction.warning}` : '',
  ].filter(Boolean).join(' ');
}

export function createDataScienceNode(streaming: StreamingService, prisma?: PrismaClient) {
  return async (state: CommerceOpsStateType) => {
    const { investigationId, userQuestion } = state;

    streaming.emit(investigationId, 'agent.started', { agent: 'DATA_SCIENCE' });

    const tools = createDataScienceTools(prisma);
    const scenarioTool = tools.find((t) => t.name === 'get_delivery_prediction_scenarios')!;
    const predictTool = tools.find((t) => t.name === 'predict_delivery_delay')!;
    const explainTool = tools.find((t) => t.name === 'explain_delivery_delay')!;

    streaming.emit(investigationId, 'tool.started', {
      agent: 'DATA_SCIENCE',
      tool: 'get_delivery_prediction_scenarios',
    });

    const scenarioRaw = await scenarioTool.invoke({
      limit: 3,
      customerStates: state.filters?.customerStates,
      categories: state.filters?.categories,
    });

    streaming.emit(investigationId, 'tool.completed', {
      agent: 'DATA_SCIENCE',
      tool: 'get_delivery_prediction_scenarios',
    });

    let scenarios: DeliveryScenario[] = [];
    try {
      const parsedScenarios = JSON.parse(scenarioRaw);
      scenarios = parsedScenarios.scenarios || [];
    } catch (e) {
      console.warn('[DSNode] Error parseando escenarios:', e);
    }

    if (scenarios.length === 0) {
      scenarios = [{
        scenarioId: 'scen-default-sp-rj',
        sellerState: 'SP',
        customerState: 'RJ',
        totalFreight: 30.0,
        totalPrice: 100.0,
        totalWeightG: 500.0,
        totalVolumeCm3: 4500.0,
        itemCount: 1,
        sellerCount: 1,
        estimatedDeliveryDays: 10.0,
        shippingWindowDays: 4.0,
        routeDistanceKm: 360.0,
        purchaseDow: 2,
        purchaseHour: 14,
        purchaseMonth: 6,
        primaryCategory: 'perfumaria',
        sellerPriorOrders: 100,
        sellerPriorLateRate: 0.08,
        sampleSize: 1000,
      }];
    }

    const predictions: Array<{ scenario: DeliveryScenario; prediction: any; explanation: any }> = [];
    const evidenceItems: any[] = [];

    for (const scenario of scenarios) {
      streaming.emit(investigationId, 'tool.started', {
        agent: 'DATA_SCIENCE',
        tool: 'predict_delivery_delay',
      });

      const predRaw = await predictTool.invoke(scenario);

      streaming.emit(investigationId, 'tool.completed', {
        agent: 'DATA_SCIENCE',
        tool: 'predict_delivery_delay',
      });

      const explainRaw = await explainTool.invoke(scenario);

      let parsedPred: any = {};
      let parsedExplain: any = {};
      try {
        parsedPred = JSON.parse(predRaw);
        parsedExplain = JSON.parse(explainRaw);
      } catch (e) {
        console.warn('[DSNode] Error parseando predicción/explicación JSON:', e);
      }

      predictions.push({
        scenario,
        prediction: parsedPred,
        explanation: parsedExplain,
      });

      const evId = `ev-ds-${scenario.scenarioId}-${Date.now()}`;
      evidenceItems.push({
        id: evId,
        toolName: 'predict_delivery_delay',
        parameters: { scenarioId: scenario.scenarioId, modelVersion: parsedPred.model_version || 'delivery-risk-v2.0.0' },
        resultSummary: buildPredictionSummary(scenario, parsedPred),
        generatedAt: new Date().toISOString(),
      });

      // Persistir ModelPrediction en BD Prisma si está disponible
      if (prisma) {
        try {
          await prisma.modelPrediction.create({
            data: {
              investigationId,
              scenarioId: scenario.scenarioId,
              modelVersion: parsedPred.model_version || parsedPred.modelVersion || 'delivery-risk-v2.0.0',
              deploymentStatus: parsedPred.deployment_status || parsedPred.deploymentStatus || 'EXPERIMENTAL_NOT_APPROVED',
              probability: floatOrZero(parsedPred.probability),
              threshold: floatOrZero(parsedPred.threshold),
              predictedDelayed: Boolean(parsedPred.predicted_delayed ?? parsedPred.predictedDelayed),
              riskLevel: parsedPred.risk_level || parsedPred.riskLevel || 'LOW',
              featuresJson: scenario as any,
              explanationJson: parsedExplain as any,
            },
          });
        } catch (dbErr) {
          console.warn('[DSNode] No se pudo persistir ModelPrediction en DB:', dbErr);
        }
      }
    }

    const firstPred = predictions[0]?.prediction || {};
    const deploymentStatus = firstPred.deployment_status || firstPred.deploymentStatus || 'EXPERIMENTAL_NOT_APPROVED';
    const reliability = deriveModelReliability(deploymentStatus, predictions[0]?.scenario?.sampleSize || 500);
    const confidence = reliabilityToConfidence(reliability);

    const predictionSummariesText = predictions.map((p) => buildPredictionSummary(p.scenario, p.prediction)).join('\n');

    const model = new ChatOpenAI({
      modelName: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `Eres el Data Science Agent de CommerceOps AI.
Pregunta del usuario: "${userQuestion}"

Escenarios evaluados cuantitativamente:
${predictionSummariesText}

REGLAS DE RIGOR METODOLÓGICO Y CERO ALUCINACIÓN:
1. Respetar los valores numéricos exactos devueltos en los resúmenes (probabilidad, threshold, riesgo, estado). Prohibido alterar cifras.
2. Describir la atribución de características SHAP únicamente para las variables presentadas.
3. Si el estado del modelo es EXPERIMENTAL_NOT_APPROVED, ADVERTIR que el modelo no está aprobado para inferencia operativa.
4. Confianza metodológica: ${confidence}.

Genera un hallazgo técnico explicable en formato JSON:
{
  "title": "Evaluación de Escenarios de Entrega (${deploymentStatus === 'APPROVED_FOR_DEMO_INFERENCE' ? 'Modelo Aprobado' : 'Modelo Experimental No Aprobado'})",
  "description": "Se analizaron ${predictions.length} escenarios representativos. ${predictionSummariesText.slice(0, 300)}...",
  "confidence": ${confidence},
  "findingType": "ML_PREDICTION"
}`;

    let title = deploymentStatus === 'APPROVED_FOR_DEMO_INFERENCE'
      ? 'Evaluación de Escenarios de Entrega ML'
      : 'Evaluación de Escenarios (Modelo Experimental No Aprobado)';
    let description = `Se analizaron ${predictions.length} escenarios representativos. Estado: ${deploymentStatus}.`;

    try {
      const response = await model.invoke(prompt);
      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.title) title = parsed.title;
        if (parsed.description) description = parsed.description;
      }
    } catch (err) {
      console.warn('[DSNode] Error in LLM call:', err);
    }

    const findingItem = {
      id: `finding-ds-${Date.now()}`,
      investigationId,
      agent: 'DATA_SCIENCE' as const,
      title,
      description,
      findingType: 'ML_PREDICTION',
      confidence,
      evidenceIds: evidenceItems.map((e) => e.id),
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
      evidence: evidenceItems,
    };
  };
}

function floatOrZero(val: any): number {
  const n = parseFloat(val);
  return isNaN(n) ? 0.0 : n;
}
