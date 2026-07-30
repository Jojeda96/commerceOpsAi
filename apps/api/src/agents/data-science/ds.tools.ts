import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { DeliveryScenariosRepository } from './delivery-scenarios.repository';

export const deliveryScenarioSchema = z.object({
  scenarioId: z.string(),
  primarySellerState: z.string().length(2),
  customerState: z.string().length(2),
  totalFreight: z.number().nonnegative(),
  totalPrice: z.number().positive(),
  totalWeightG: z.number().nonnegative(),
  totalVolumeCm3: z.number().nonnegative(),
  itemCount: z.number().int().positive(),
  sellerCount: z.number().int().positive(),
  estimatedDeliveryDays: z.number().positive(),
  shippingWindowDays: z.number().positive(),
  routeDistanceKm: z.number().nonnegative().nullable(),
  purchaseDow: z.number().int().min(0).max(6),
  purchaseHour: z.number().int().min(0).max(23),
  purchaseMonth: z.number().int().min(1).max(12),
  purchaseWeek: z.number().int().min(1).max(53),
  primaryCategory: z.string().min(1),
  sellerPriorOrders: z.number().int().nonnegative(),
  sellerPriorLateRateSmoothed: z.number().min(0).max(1),
  routePriorOrders: z.number().int().nonnegative(),
  routePriorLateRateSmoothed: z.number().min(0).max(1),
  categoryPriorOrders: z.number().int().nonnegative(),
  categoryPriorLateRateSmoothed: z.number().min(0).max(1),
  sampleSize: z.number().int().positive().optional(),
  historicalLateRate: z.number().min(0).max(1).optional(),
});

export type DeliveryScenario = z.infer<typeof deliveryScenarioSchema>;

export function createDataScienceTools(prisma: PrismaClient) {
  const repo = new DeliveryScenariosRepository(prisma);

  const getDeliveryModelGovernance = tool(
    async () => {
      const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
      try {
        const [runtimeRes, metricsRes] = await Promise.all([
          fetch(`${mlServiceUrl}/models/delivery-delay/runtime`).catch(() => null),
          fetch(`${mlServiceUrl}/models/delivery-delay/metrics`).catch(() => null),
        ]);

        let runtimeData: any = {};
        let metricsData: any = {};

        if (runtimeRes && runtimeRes.ok) {
          runtimeData = await runtimeRes.json();
        }
        if (metricsRes && metricsRes.ok) {
          metricsData = await metricsRes.json();
        }

        const isAvailable = Boolean(runtimeRes && runtimeRes.ok);

        return JSON.stringify({
          status: isAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
          modelName: runtimeData.model_name || runtimeData.modelName || 'delivery_delay_champion',
          modelVersion: runtimeData.model_version || runtimeData.modelVersion || 'v3.0.0',
          deploymentStatus: runtimeData.deployment_status || runtimeData.deploymentStatus || 'EXPERIMENTAL_NOT_APPROVED',
          operationallyActionable: Boolean(runtimeData.operationally_actionable || runtimeData.operationallyActionable || false),
          qualityGateReasons: runtimeData.quality_gate_reasons || runtimeData.qualityGateReasons || ['MODEL_EXPERIMENTAL_NOT_APPROVED'],
          testMetrics: metricsData.test_metrics || metricsData.testMetrics || runtimeData.test_metrics || {},
          runtimeLoaded: Boolean(runtimeData.runtime_loaded || runtimeData.runtimeLoaded || isAvailable),
        });
      } catch (err: any) {
        return JSON.stringify({
          status: 'UNAVAILABLE',
          reason: 'MODEL_GOVERNANCE_SERVICE_UNREACHABLE',
          message: err?.message || 'Connection refused',
          operationallyActionable: false,
          qualityGateReasons: ['MODEL_SERVICE_UNREACHABLE'],
          runtimeLoaded: false,
        });
      }
    },
    {
      name: 'get_delivery_model_governance',
      description: 'Consulta el estado de gobernanza, quality gates, versión y métricas del modelo ML desde ml-service.',
      schema: z.object({}),
    },
  );

  const getDeliveryPredictionScenarios = tool(
    async ({
      limit = 3,
      selectionMethod = 'REPRESENTATIVE_MEDIAN',
      customerStates,
      sellerStates,
      categories,
      minOrders = 10,
      dateFrom,
      dateTo,
      interstateOnly = false,
      scopeHash = 'unspecified',
    }) => {
      try {
        const parsedDateFrom = dateFrom ? new Date(dateFrom) : undefined;
        const parsedDateTo = dateTo ? new Date(dateTo) : undefined;

        const scenarios = await repo.getScenarios({
          limit,
          selectionMethod,
          customerStates,
          sellerStates,
          categories,
          minOrders,
          dateFrom: parsedDateFrom,
          dateTo: parsedDateTo,
          interstateOnly,
        });

        const appliedScope = {
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
          categories: categories || null,
          sellerStates: sellerStates || null,
          customerStates: customerStates || null,
          interstateOnly: Boolean(interstateOnly),
          scopeHash,
        };

        if (scenarios.length === 0) {
          return JSON.stringify({
            status: 'UNAVAILABLE',
            reasonCode: 'NO_SCENARIOS_MATCH_FILTERS',
            appliedScope,
            scopeHash,
            rowCount: 0,
            sampleSize: 0,
            scenarios: [],
            diagnostics: {
              minOrders,
              candidateOrders: 0,
              candidateGroupsBeforeMinimum: 0,
              candidateGroupsAfterMinimum: 0,
              excludedForMissingFeatures: 0,
              selectedScenarios: 0,
            },
          });
        }

        const totalSampleSize = scenarios.reduce((acc, s) => acc + (s.sampleSize || 0), 0);

        return JSON.stringify({
          status: 'AVAILABLE',
          appliedScope,
          scopeHash,
          rowCount: scenarios.length,
          sampleSize: totalSampleSize,
          selectionMethod,
          scenarios,
          diagnostics: {
            minOrders,
            candidateOrders: totalSampleSize,
            candidateGroupsBeforeMinimum: scenarios.length,
            candidateGroupsAfterMinimum: scenarios.length,
            excludedForMissingFeatures: 0,
            selectedScenarios: scenarios.length,
          },
        });
      } catch (error: any) {
        console.warn(
          '[DS Tools] Error consultando escenarios en PostgreSQL:',
          error,
        );
        return JSON.stringify({
          status: 'ERROR',
          reasonCode: 'DATABASE_QUERY_FAILED',
          scopeHash,
          errorCode: error?.code || 'UNKNOWN_DB_ERROR',
          scenarios: [],
        });
      }
    },
    {
      name: 'get_delivery_prediction_scenarios',
      description:
        'Consulta y devuelve escenarios reales de entrega calculados desde PostgreSQL dentro del AnalysisScope.',
      schema: z.object({
        limit: z.number().default(3),
        selectionMethod: z.string().optional(),
        customerStates: z.array(z.string()).optional(),
        sellerStates: z.array(z.string()).optional(),
        categories: z.array(z.string()).optional(),
        minOrders: z.number().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        interstateOnly: z.boolean().default(false),
        scopeHash: z.string(),
      }),
    },
  );

  const predictDeliveryDelay = tool(
    async (scenario) => {
      const mlServiceUrl =
        process.env.ML_SERVICE_URL || 'http://localhost:8000';
      const allowExperimental =
        process.env.ENABLE_EXPERIMENTAL_ML_IN_WORKFLOW === 'true';

      const url = new URL('/models/delivery-delay/predict', mlServiceUrl);
      if (allowExperimental) {
        url.searchParams.set('allow_experimental', 'true');
      }

      try {
        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenario_id: scenario.scenarioId || 'scen-custom',
            primary_seller_state: scenario.primarySellerState,
            customer_state: scenario.customerState,
            total_freight: scenario.totalFreight,
            total_price: scenario.totalPrice,
            total_weight_g: scenario.totalWeightG,
            total_volume_cm3: scenario.totalVolumeCm3,
            item_count: scenario.itemCount,
            seller_count: scenario.sellerCount,
            estimated_delivery_days: scenario.estimatedDeliveryDays,
            shipping_window_days: scenario.shippingWindowDays,
            route_distance_km: scenario.routeDistanceKm,
            purchase_dow: scenario.purchaseDow,
            purchase_hour: scenario.purchaseHour,
            purchase_month: scenario.purchaseMonth,
            purchase_week: scenario.purchaseWeek,
            primary_category: scenario.primaryCategory,
            seller_prior_orders: scenario.sellerPriorOrders,
            seller_prior_late_rate_smoothed:
              scenario.sellerPriorLateRateSmoothed,
            route_prior_orders: scenario.routePriorOrders,
            route_prior_late_rate_smoothed: scenario.routePriorLateRateSmoothed,
            category_prior_orders: scenario.categoryPriorOrders,
            category_prior_late_rate_smoothed:
              scenario.categoryPriorLateRateSmoothed,
          }),
        });

        if (response.ok) {
          const data: any = await response.json();
          return JSON.stringify({
            status: 'AVAILABLE',
            ...data,
          });
        }

        const errDetail = await response.json().catch(() => ({}));
        return JSON.stringify({
          status: 'UNAVAILABLE',
          reasonCode: 'MODEL_SERVICE_HTTP_ERROR',
          statusCode: response.status,
          detail: errDetail,
        });
      } catch (err: any) {
        return JSON.stringify({
          status: 'UNAVAILABLE',
          reasonCode: 'MODEL_SERVICE_UNREACHABLE',
          message: err?.message || 'Connection refused',
        });
      }
    },
    {
      name: 'predict_delivery_delay',
      description:
        'Ejecuta la inferencia del modelo ML sobre un escenario real de entrega.',
      schema: deliveryScenarioSchema.partial({ scenarioId: true }),
    },
  );

  const explainDeliveryDelay = tool(
    async (scenario) => {
      const mlServiceUrl =
        process.env.ML_SERVICE_URL || 'http://localhost:8000';
      const allowExperimental =
        process.env.ENABLE_EXPERIMENTAL_ML_IN_WORKFLOW === 'true';

      const url = new URL('/models/delivery-delay/explain', mlServiceUrl);
      if (allowExperimental) {
        url.searchParams.set('allow_experimental', 'true');
      }

      try {
        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenario_id: scenario.scenarioId || 'scen-custom',
            primary_seller_state: scenario.primarySellerState,
            customer_state: scenario.customerState,
            total_freight: scenario.totalFreight,
            total_price: scenario.totalPrice,
            total_weight_g: scenario.totalWeightG,
            total_volume_cm3: scenario.totalVolumeCm3,
            item_count: scenario.itemCount,
            seller_count: scenario.sellerCount,
            estimated_delivery_days: scenario.estimatedDeliveryDays,
            shipping_window_days: scenario.shippingWindowDays,
            route_distance_km: scenario.routeDistanceKm,
            purchase_dow: scenario.purchaseDow,
            purchase_hour: scenario.purchaseHour,
            purchase_month: scenario.purchaseMonth,
            purchase_week: scenario.purchaseWeek,
            primary_category: scenario.primaryCategory,
            seller_prior_orders: scenario.sellerPriorOrders,
            seller_prior_late_rate_smoothed:
              scenario.sellerPriorLateRateSmoothed,
            route_prior_orders: scenario.routePriorOrders,
            route_prior_late_rate_smoothed: scenario.routePriorLateRateSmoothed,
            category_prior_orders: scenario.categoryPriorOrders,
            category_prior_late_rate_smoothed:
              scenario.categoryPriorLateRateSmoothed,
          }),
        });

        if (response.ok) {
          const data: any = await response.json();
          return JSON.stringify({
            status: 'AVAILABLE',
            explanationType: data.explanation_type || 'LOCAL_SHAP',
            topFeatures: data.top_features || data.topFeatures || [],
            baseValue: data.base_value || data.baseValue,
          });
        }

        return JSON.stringify({
          status: 'UNAVAILABLE',
          explanationType: 'UNAVAILABLE',
          reasonCode: 'MODEL_EXPLAIN_UNAVAILABLE',
        });
      } catch (err: any) {
        return JSON.stringify({
          status: 'UNAVAILABLE',
          explanationType: 'UNAVAILABLE',
          reasonCode: 'MODEL_EXPLAIN_UNREACHABLE',
        });
      }
    },
    {
      name: 'explain_delivery_delay',
      description:
        'Obtiene la atribución de características SHAP para una predicción real.',
      schema: deliveryScenarioSchema.partial({ scenarioId: true }),
    },
  );

  return [
    getDeliveryModelGovernance,
    getDeliveryPredictionScenarios,
    predictDeliveryDelay,
    explainDeliveryDelay,
  ];
}
