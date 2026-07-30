import { ChatOpenAI } from '@langchain/openai';
import { PrismaClient } from '@prisma/client';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { StreamingService } from '../../streaming/streaming.service';
import { Finding } from '@commerce-ops/shared-types';
import { createDataScienceTools, DeliveryScenario } from './ds.tools';
import {
  runAgentWithTrace,
  executeToolWithTrace,
} from '../../observability/agent-runner';
import { extractModelUsage } from '../../observability/usage';
import { ToolExecutionTrace } from '@commerce-ops/shared-types';

export type ModelReliability =
  'UNAVAILABLE' | 'LOW' | 'MODERATE' | 'APPROVED_FOR_DEMO';

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
      return 0.1;
    case 'LOW':
      return 0.3;
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
  if (
    !prediction ||
    prediction.prediction_status !== 'SUCCESS' ||
    prediction.status === 'UNAVAILABLE'
  ) {
    return `Escenario ${scenario.primarySellerState}→${scenario.customerState} (${scenario.primaryCategory || 'general'}): Servicio ML no disponible para inferencia (${prediction?.reason || prediction?.detail?.message || 'UNAVAILABLE'}).`;
  }

  const probPct = (prediction.probability * 100).toFixed(1);
  const threshPct = (prediction.threshold * 100).toFixed(1);
  return [
    `Escenario ${scenario.primarySellerState}→${scenario.customerState} (${scenario.primaryCategory || 'general'}).`,
    `Probabilidad estimada de atraso: ${probPct}%.`,
    `Threshold operativo: ${threshPct}%.`,
    `Nivel de riesgo: ${prediction.riskLevel || prediction.risk_level}.`,
    `Modelo: ${prediction.model_name || prediction.modelName}.`,
    `Estado del modelo: ${prediction.deploymentStatus || prediction.deployment_status || 'EXPERIMENTAL_NOT_APPROVED'}.`,
    prediction.warning ? `Advertencia: ${prediction.warning}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function createDataScienceNode(
  streaming: StreamingService,
  prisma: PrismaClient,
) {
  return async (state: CommerceOpsStateType) => {
    const { investigationId, userQuestion } = state;
    const iteration = state.iteration || 1;
    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    streaming.emit(investigationId, 'agent.started', { agent: 'DATA_SCIENCE' });

    const tools = createDataScienceTools(prisma);
    const scenarioTool = tools.find(
      (t) => t.name === 'get_delivery_prediction_scenarios',
    )!;
    const predictTool = tools.find((t) => t.name === 'predict_delivery_delay')!;
    const explainTool = tools.find((t) => t.name === 'explain_delivery_delay')!;

    const { result, trace: agentTrace } = await runAgentWithTrace({
      agentName: 'DATA_SCIENCE',
      iteration,
      modelName,
      execute: async ({ localRunId }) => {
        const toolTraces: ToolExecutionTrace[] = [];
        const scenarioParams = {
          limit: 3,
          customerStates: state.filters?.customerStates,
          categories: state.filters?.categories,
        };

        streaming.emit(investigationId, 'tool.started', {
          agent: 'DATA_SCIENCE',
          tool: 'get_delivery_prediction_scenarios',
        });

        const { result: scenarioRaw, trace: scenarioTrace } =
          await executeToolWithTrace({
            localAgentRunId: localRunId,
            agentName: 'DATA_SCIENCE',
            iteration,
            toolName: 'get_delivery_prediction_scenarios',
            parameters: scenarioParams,
            execute: () => scenarioTool.invoke(scenarioParams),
          });
        toolTraces.push(scenarioTrace);
        streaming.emit(investigationId, 'tool.completed', {
          agent: 'DATA_SCIENCE',
          tool: 'get_delivery_prediction_scenarios',
        });

        let scenarioPayload: {
          status: string;
          scenarios?: DeliveryScenario[];
          reason?: string;
        } = {
          status: 'UNAVAILABLE',
        };
        try {
          scenarioPayload = JSON.parse(scenarioRaw);
        } catch (e) {
          console.warn('[DSNode] Error parseando JSON de escenarios:', e);
        }

        if (
          scenarioPayload.status !== 'AVAILABLE' ||
          !scenarioPayload.scenarios ||
          scenarioPayload.scenarios.length === 0
        ) {
          const unavailableFinding: Finding = {
            id: `finding-ds-unavailable-${Date.now()}`,
            investigationId,
            localAgentRunId: localRunId,
            agent: 'DATA_SCIENCE',
            title:
              'No fue posible construir escenarios ML con los filtros aplicados',
            description: `Los filtros aplicados no devolvieron escenarios con el mínimo de observaciones requerido en PostgreSQL (${scenarioPayload.reason || 'NO_SCENARIOS'}). No se ejecutaron predicciones ML.`,
            findingType: 'ML_UNAVAILABLE',
            confidence: 1.0,
            evidenceIds: [],
            operationalStatus: 'BLOCKED',
            createdAt: new Date().toISOString(),
          };

          streaming.emit(investigationId, 'finding.created', {
            agent: 'DATA_SCIENCE',
            finding: unavailableFinding,
          });
          streaming.emit(investigationId, 'agent.completed', {
            agent: 'DATA_SCIENCE',
          });

          return {
            result: {
              finding: unavailableFinding,
              evidence: [] as any[],
              toolTraces,
              modelPredictions: [] as any[],
            },
          };
        }

        const scenarios = scenarioPayload.scenarios;
        const predictions: Array<{
          scenario: DeliveryScenario;
          prediction: any;
          explanation: any;
        }> = [];
        const evidenceItems: any[] = [];

        for (const scenario of scenarios) {
          streaming.emit(investigationId, 'tool.started', {
            agent: 'DATA_SCIENCE',
            tool: 'predict_delivery_delay',
          });

          const { result: predRaw, trace: predictTrace } =
            await executeToolWithTrace({
              localAgentRunId: localRunId,
              agentName: 'DATA_SCIENCE',
              iteration,
              toolName: 'predict_delivery_delay',
              parameters: scenario,
              execute: () => predictTool.invoke(scenario),
            });
          toolTraces.push(predictTrace);
          streaming.emit(investigationId, 'tool.completed', {
            agent: 'DATA_SCIENCE',
            tool: 'predict_delivery_delay',
          });

          let parsedPred: any = {};
          try {
            parsedPred = JSON.parse(predRaw);
          } catch (e) {
            console.warn('[DSNode] Error parseando predicción JSON:', e);
          }

          // If prediction failed or status is not SUCCESS, do NOT call explain and do NOT add to modelPredictions
          if (
            parsedPred.prediction_status !== 'SUCCESS' &&
            parsedPred.status !== 'SUCCESS'
          ) {
            console.warn(
              '[DSNode] Prediction failed or status unavailable:',
              parsedPred,
            );
            continue;
          }

          const { result: explainRaw, trace: explainTrace } =
            await executeToolWithTrace({
              localAgentRunId: localRunId,
              agentName: 'DATA_SCIENCE',
              iteration,
              toolName: 'explain_delivery_delay',
              parameters: scenario,
              execute: () => explainTool.invoke(scenario),
            });
          toolTraces.push(explainTrace);

          let parsedExplain: any = {};
          try {
            parsedExplain = JSON.parse(explainRaw);
          } catch (e) {
            console.warn('[DSNode] Error parseando explicación JSON:', e);
          }

          predictions.push({
            scenario,
            prediction: parsedPred,
            explanation: parsedExplain,
          });

          const evId = `ev-ds-${scenario.scenarioId}-${Date.now()}`;
          evidenceItems.push({
            id: evId,
            localAgentRunId: localRunId,
            localToolExecutionId: predictTrace.localExecutionId,
            sourceType: 'TOOL_EXECUTION' as const,
            agentName: 'DATA_SCIENCE' as const,
            iteration,
            toolName: 'predict_delivery_delay',
            parameters: {
              scenarioId: scenario.scenarioId,
              modelVersion: parsedPred.model_version || parsedPred.modelVersion,
            },
            resultSummary: buildPredictionSummary(scenario, parsedPred),
            generatedAt: new Date().toISOString(),
          });
        }

        // Handle case where all predictions failed
        if (predictions.length === 0) {
          const mlUnavailableFinding: Finding = {
            id: `finding-ds-ml-unavailable-${Date.now()}`,
            investigationId,
            localAgentRunId: localRunId,
            agent: 'DATA_SCIENCE',
            title: 'Servicio ML No Disponible para Inferencia',
            description:
              'El servicio de inferencia de modelos ML no retornó respuestas válidas para los escenarios evaluados.',
            findingType: 'ML_UNAVAILABLE',
            confidence: 1.0,
            evidenceIds: [],
            operationalStatus: 'BLOCKED',
            createdAt: new Date().toISOString(),
          };

          return {
            result: {
              finding: mlUnavailableFinding,
              evidence: [],
              toolTraces,
              modelPredictions: [],
            },
          };
        }

        const firstPred = predictions[0]?.prediction || {};
        const deploymentStatus =
          firstPred.deployment_status ||
          firstPred.deploymentStatus ||
          'EXPERIMENTAL_NOT_APPROVED';
        const reliability = deriveModelReliability(
          deploymentStatus,
          predictions[0]?.scenario?.sampleSize || 500,
        );
        const confidence = reliabilityToConfidence(reliability);

        const isApproved = deploymentStatus === 'APPROVED_FOR_DEMO_INFERENCE';
        const allowExperimental =
          process.env.ENABLE_EXPERIMENTAL_ML_IN_WORKFLOW === 'true';

        const operationalStatus = isApproved
          ? ('ACTIONABLE' as const)
          : allowExperimental
            ? ('EXPERIMENTAL_CONTEXT' as const)
            : ('BLOCKED' as const);

        const predictionSummariesText = predictions
          .map((p) => buildPredictionSummary(p.scenario, p.prediction))
          .join('\n');

        const model = new ChatOpenAI({
          modelName,
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
  "title": "Evaluación de Escenarios de Entrega (${isApproved ? 'Modelo Aprobado' : 'Modelo Experimental No Aprobado'})",
  "description": "Se analizaron ${predictions.length} escenarios representativos reales. ${predictionSummariesText.slice(0, 300)}...",
  "confidence": ${confidence},
  "findingType": "ML_PREDICTION"
}`;

        let title = isApproved
          ? 'Evaluación de Escenarios de Entrega ML'
          : 'Evaluación de Escenarios (Modelo Experimental No Aprobado)';
        let description = `Se analizaron ${predictions.length} escenarios representativos. Estado: ${deploymentStatus}.`;
        let inputTokens: number | undefined;
        let outputTokens: number | undefined;

        try {
          const response = await model.invoke(prompt);
          const usage = extractModelUsage(response);
          inputTokens = usage.inputTokens;
          outputTokens = usage.outputTokens;

          const content =
            typeof response.content === 'string'
              ? response.content
              : JSON.stringify(response.content);
          const match = content.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.title) title = parsed.title;
            if (parsed.description) description = parsed.description;
          }
        } catch (err) {
          console.warn('[DSNode] Error in LLM call:', err);
        }

        const findingId = `finding-ds-${Date.now()}`;
        const findingItem: Finding = {
          id: findingId,
          investigationId,
          localAgentRunId: localRunId,
          agent: 'DATA_SCIENCE',
          title,
          description,
          findingType: 'ML_PREDICTION',
          confidence,
          evidenceIds: evidenceItems.map((e) => e.id),
          operationalStatus,
          modelGovernance: {
            modelName: firstPred.model_name || firstPred.modelName,
            modelVersion: firstPred.model_version || firstPred.modelVersion,
            deploymentStatus,
            operationallyActionable: isApproved,
            reasons:
              firstPred.deployment_reasons || firstPred.deploymentReasons || [],
          },
          createdAt: new Date().toISOString(),
        };

        const modelPredictionTraces = predictions.map((p) => ({
          investigationId,
          findingId,
          scenarioId: p.scenario.scenarioId,
          modelName: p.prediction.model_name || p.prediction.modelName,
          modelVersion: p.prediction.model_version || p.prediction.modelVersion,
          deploymentStatus:
            p.prediction.deployment_status ||
            p.prediction.deploymentStatus ||
            'EXPERIMENTAL_NOT_APPROVED',
          probability: Number(p.prediction.probability || 0),
          threshold: Number(p.prediction.threshold || 0.5),
          predictedDelayed: Boolean(
            p.prediction.predicted_delayed || p.prediction.predictedDelayed,
          ),
          riskLevel: p.prediction.risk_level || p.prediction.riskLevel || 'LOW',
          operationallyActionable: isApproved,
          featuresJson: p.scenario,
          explanationJson: p.explanation,
        }));

        streaming.emit(investigationId, 'finding.created', {
          agent: 'DATA_SCIENCE',
          finding: findingItem,
        });
        streaming.emit(investigationId, 'agent.completed', {
          agent: 'DATA_SCIENCE',
        });

        return {
          result: {
            finding: findingItem,
            evidence: evidenceItems,
            toolTraces,
            modelPredictions: modelPredictionTraces,
          },
          inputTokens,
          outputTokens,
        };
      },
    });

    return {
      completedAgents: [...state.completedAgents, 'DATA_SCIENCE' as const],
      agentRunTraces: [agentTrace],
      toolExecutionTraces: result.toolTraces,
      findings: [result.finding],
      evidence: result.evidence,
      modelPredictions: result.modelPredictions,
    };
  };
}
