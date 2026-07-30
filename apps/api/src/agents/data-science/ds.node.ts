import { ChatOpenAI } from '@langchain/openai';
import { PrismaClient } from '@prisma/client';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { StreamingService } from '../../streaming/streaming.service';
import { Finding, Evidence } from '@commerce-ops/shared-types';
import { createDataScienceTools, DeliveryScenario } from './ds.tools';
import {
  runAgentWithTrace,
  executeToolWithTrace,
} from '../../observability/agent-runner';
import { extractModelUsage } from '../../observability/usage';
import { ToolExecutionTrace } from '@commerce-ops/shared-types';
import { buildToolScope } from '../scope/build-tool-scope';
import { isPersistablePrediction } from './contracts/prediction-result.schema';

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
    const govTool = tools.find((t) => t.name === 'get_delivery_model_governance')!;
    const scenarioTool = tools.find(
      (t) => t.name === 'get_delivery_prediction_scenarios',
    )!;
    const predictTool = tools.find((t) => t.name === 'predict_delivery_delay')!;
    const explainTool = tools.find((t) => t.name === 'explain_delivery_delay')!;

    const { result, trace: agentTrace } = await runAgentWithTrace({
      agentName: 'DATA_SCIENCE',
      iteration,
      investigationId,
      modelName,
      execute: async ({ localRunId }) => {
        const toolTraces: ToolExecutionTrace[] = [];
        const evidenceItems: Evidence[] = [];
        const commonScope = buildToolScope(state.analysisScope);

        // 1. Always execute Model Governance tool
        streaming.emit(investigationId, 'tool.started', {
          agent: 'DATA_SCIENCE',
          tool: 'get_delivery_model_governance',
        });
        const { result: govRaw, trace: govTrace } = await executeToolWithTrace({
          localAgentRunId: localRunId,
          agentName: 'DATA_SCIENCE',
          iteration,
          toolName: 'get_delivery_model_governance',
          parameters: {},
          execute: () => govTool.invoke({}),
        });
        toolTraces.push(govTrace);
        streaming.emit(investigationId, 'tool.completed', {
          agent: 'DATA_SCIENCE',
          tool: 'get_delivery_model_governance',
        });

        let govData: any = {};
        try {
          govData = JSON.parse(govRaw);
        } catch (e) {
          console.warn('[DSNode] Error parsing governance JSON:', e);
        }

        const govEvId = `ev-ds-gov-${Date.now()}`;
        evidenceItems.push({
          id: govEvId,
          localAgentRunId: localRunId,
          localToolExecutionId: govTrace.localExecutionId,
          sourceType: 'TOOL_EXECUTION',
          agentName: 'DATA_SCIENCE',
          iteration,
          toolName: 'get_delivery_model_governance',
          parameters: {},
          resultSummary: govRaw,
          generatedAt: new Date().toISOString(),
        });

        // 2. Query Scenarios within AnalysisScope
        const scenarioParams = {
          limit: 3,
          minOrders: 10,
          selectionMethod: 'REPRESENTATIVE_MEDIAN',
          ...commonScope,
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

        let scenarioPayload: any = {};
        try {
          scenarioPayload = JSON.parse(scenarioRaw);
        } catch (e) {
          console.warn('[DSNode] Error parsing scenarios JSON:', e);
        }

        const scenEvId = `ev-ds-scen-${Date.now()}`;
        evidenceItems.push({
          id: scenEvId,
          localAgentRunId: localRunId,
          localToolExecutionId: scenarioTrace.localExecutionId,
          sourceType: 'TOOL_EXECUTION',
          agentName: 'DATA_SCIENCE',
          iteration,
          toolName: 'get_delivery_prediction_scenarios',
          parameters: scenarioParams,
          resultSummary: scenarioRaw,
          rowCount: scenarioPayload.rowCount || 0,
          sampleSize: scenarioPayload.sampleSize || 0,
          generatedAt: new Date().toISOString(),
        });

        // Branch when no scenarios matched: Partial Answer with Governance & Historical Context
        if (
          scenarioPayload.status !== 'AVAILABLE' ||
          !scenarioPayload.scenarios ||
          scenarioPayload.scenarios.length === 0
        ) {
          const partialFinding: Finding = {
            id: `finding-ds-partial-${Date.now()}`,
            investigationId,
            localAgentRunId: localRunId,
            agent: 'DATA_SCIENCE',
            title: 'Estado de Gobernanza del Modelo (Sin Escenarios Inferibles para Scope)',
            description: `Se obtuvo el estado de gobernanza del modelo (${govData.modelName || 'delivery_delay_champion'} v${govData.modelVersion || 'v3.0.0'}, deployment: ${govData.deploymentStatus || 'EXPERIMENTAL_NOT_APPROVED'}). No se ejecutó inferencia predictiva ni SHAP debido a que ningún escenario cumplió los criterios de filtrado y muestra mínima.`,
            findingType: 'MODEL_GOVERNANCE',
            confidence: 0.85,
            evidenceIds: [govEvId, scenEvId],
            operationalStatus: 'EXPERIMENTAL_CONTEXT',
            modelGovernance: {
              modelName: govData.modelName || 'delivery_delay_champion',
              modelVersion: govData.modelVersion || 'v3.0.0',
              deploymentStatus: govData.deploymentStatus || 'EXPERIMENTAL_NOT_APPROVED',
              operationallyActionable: Boolean(govData.operationallyActionable),
              reasons: govData.qualityGateReasons || [],
            },
            createdAt: new Date().toISOString(),
          };

          streaming.emit(investigationId, 'finding.created', {
            agent: 'DATA_SCIENCE',
            finding: partialFinding,
          });
          streaming.emit(investigationId, 'agent.completed', {
            agent: 'DATA_SCIENCE',
          });

          return {
            result: {
              finding: partialFinding,
              evidence: evidenceItems,
              toolTraces,
              modelPredictions: [],
            },
          };
        }

        // Branch when scenarios exist: run predictions and explanations
        const scenarios: DeliveryScenario[] = scenarioPayload.scenarios;
        const predictions: Array<{
          scenario: DeliveryScenario;
          prediction: any;
          explanation: any;
        }> = [];

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
            console.warn('[DSNode] Error parsing prediction JSON:', e);
          }

          if (parsedPred.status !== 'AVAILABLE') {
            console.warn('[DSNode] Inferencia no disponible para escenario:', scenario.scenarioId);
            continue;
          }

          // Execute explanation tool ONLY when prediction is AVAILABLE
          streaming.emit(investigationId, 'tool.started', {
            agent: 'DATA_SCIENCE',
            tool: 'explain_delivery_delay',
          });
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
          streaming.emit(investigationId, 'tool.completed', {
            agent: 'DATA_SCIENCE',
            tool: 'explain_delivery_delay',
          });

          let parsedExplain: any = {};
          try {
            parsedExplain = JSON.parse(explainRaw);
          } catch (e) {
            console.warn('[DSNode] Error parsing explanation JSON:', e);
          }

          predictions.push({
            scenario,
            prediction: parsedPred,
            explanation: parsedExplain,
          });

          const predEvId = `ev-ds-pred-${scenario.scenarioId}-${Date.now()}`;
          evidenceItems.push({
            id: predEvId,
            localAgentRunId: localRunId,
            localToolExecutionId: predictTrace.localExecutionId,
            sourceType: 'MODEL_PREDICTION',
            agentName: 'DATA_SCIENCE',
            iteration,
            toolName: 'predict_delivery_delay',
            parameters: { scenarioId: scenario.scenarioId },
            resultSummary: JSON.stringify(parsedPred),
            generatedAt: new Date().toISOString(),
          });
        }

        const isApproved = govData.deploymentStatus === 'APPROVED_FOR_DEMO_INFERENCE';

        const model = new ChatOpenAI({
          modelName,
          temperature: 0.1,
          apiKey: process.env.OPENAI_API_KEY,
        });

        const prompt = `Eres el Data Science Agent de CommerceOps AI.
Pregunta del usuario: "${userQuestion}"

Gobernanza del modelo:
${govRaw}

Predicciones de escenarios:
${JSON.stringify(predictions, null, 2)}

Genera un hallazgo técnico cuantitativo y auditable en formato JSON:
{
  "title": "Inferencia Predictiva y Factores de Impacto en Envíos",
  "description": "Detalle cuantitativo de la probabilidad predictiva y factores de mayor contribución local.",
  "confidence": 0.88,
  "findingType": "ML_PREDICTION"
}`;

        let title = 'Inferencia Predictiva y Factores de Impacto';
        let description = `Se ejecutó inferencia predictiva para ${predictions.length} escenarios representativos.`;
        let confidence = 0.88;

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
          console.warn('[DSNode] LLM call error:', err);
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
          operationalStatus: isApproved ? 'ACTIONABLE' : 'EXPERIMENTAL_CONTEXT',
          modelGovernance: {
            modelName: govData.modelName || 'delivery_delay_champion',
            modelVersion: govData.modelVersion || 'v3.0.0',
            deploymentStatus: govData.deploymentStatus || 'EXPERIMENTAL_NOT_APPROVED',
            operationallyActionable: Boolean(isApproved),
            reasons: govData.qualityGateReasons || [],
          },
          createdAt: new Date().toISOString(),
        };

        const modelPredictionTraces = predictions
          .filter((p) => isPersistablePrediction(p.prediction))
          .map((p) => ({
            investigationId,
            findingId,
            scenarioId: p.scenario.scenarioId,
            modelName: p.prediction.modelName || govData.modelName || 'delivery_delay_champion',
            modelVersion: p.prediction.modelVersion || govData.modelVersion || 'v3.0.0',
            deploymentStatus: govData.deploymentStatus || 'EXPERIMENTAL_NOT_APPROVED',
            probability: Number(p.prediction.probability),
            threshold: Number(p.prediction.threshold),
            predictedDelayed: Boolean(p.prediction.predictedDelayed),
            riskLevel: p.prediction.riskLevel || 'LOW',
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
