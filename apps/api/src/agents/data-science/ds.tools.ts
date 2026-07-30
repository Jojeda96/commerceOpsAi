import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { DeliveryScenariosRepository } from './delivery-scenarios.repository';

export const deliveryScenarioSchema = z.object({
  scenarioId: z.string(),
  sellerState: z.string().length(2),
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
  primaryCategory: z.string().nullable(),
  sellerPriorOrders: z.number().int().nonnegative(),
  sellerPriorLateRate: z.number().min(0).max(1).nullable(),
  routePriorOrders: z.number().int().nonnegative(),
  routePriorLateRate: z.number().min(0).max(1).nullable(),
  categoryPriorOrders: z.number().int().nonnegative(),
  categoryPriorLateRate: z.number().min(0).max(1).nullable(),
  sampleSize: z.number().int().positive(),
  historicalLateRate: z.number().min(0).max(1),
});

export type DeliveryScenario = z.infer<typeof deliveryScenarioSchema>;

export function createDataScienceTools(prisma: PrismaClient) {
  const repo = new DeliveryScenariosRepository(prisma);

  const getDeliveryPredictionScenarios = tool(
    async ({ limit, selectionMethod, customerStates, categories, minOrders }) => {
      try {
        const scenarios = await repo.getScenarios({
          limit,
          selectionMethod,
          customerStates,
          categories,
          minOrders,
        });

        if (scenarios.length === 0) {
          return JSON.stringify({
            status: 'UNAVAILABLE',
            reason: 'NO_SCENARIOS_MATCH_FILTERS',
            selectionMethod: selectionMethod || 'TOP_VOLUME',
            scenarios: [],
          });
        }

        return JSON.stringify({
          status: 'AVAILABLE',
          selectionMethod: selectionMethod || 'TOP_VOLUME',
          scenarios,
        });
      } catch (error: any) {
        console.warn('[DS Tools] Error consultando escenarios en PostgreSQL:', error);
        return JSON.stringify({
          status: 'ERROR',
          reason: 'DATABASE_QUERY_FAILED',
          errorCode: error?.code || 'UNKNOWN_DB_ERROR',
          scenarios: [],
        });
      }
    },
    {
      name: 'get_delivery_prediction_scenarios',
      description:
        'Consulta y devuelve escenarios reales de entrega calculados desde PostgreSQL sin datos sintéticos.',
      schema: z.object({
        limit: z.number().default(3),
        selectionMethod: z.string().optional(),
        customerStates: z.array(z.string()).optional(),
        categories: z.array(z.string()).optional(),
        minOrders: z.number().optional(),
      }),
    },
  );

  const predictDeliveryDelay = tool(
    async (scenario) => {
      const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
      const allowExperimental = process.env.ENABLE_EXPERIMENTAL_ML_IN_WORKFLOW === 'true';

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
            seller_state: scenario.sellerState,
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
            seller_prior_late_rate: scenario.sellerPriorLateRate,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return JSON.stringify(data);
        }

        const errDetail = await response.json().catch(() => ({}));
        return JSON.stringify({
          status: 'UNAVAILABLE',
          reason: 'MODEL_SERVICE_HTTP_ERROR',
          statusCode: response.status,
          detail: errDetail,
        });
      } catch (err: any) {
        return JSON.stringify({
          status: 'UNAVAILABLE',
          reason: 'MODEL_SERVICE_UNREACHABLE',
          message: err?.message || 'Connection refused',
        });
      }
    },
    {
      name: 'predict_delivery_delay',
      description: 'Ejecuta la inferencia del modelo ML sobre un escenario real de entrega.',
      schema: deliveryScenarioSchema.partial({ scenarioId: true }),
    },
  );

  const explainDeliveryDelay = tool(
    async (scenario) => {
      const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
      const allowExperimental = process.env.ENABLE_EXPERIMENTAL_ML_IN_WORKFLOW === 'true';

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
            seller_state: scenario.sellerState,
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
            seller_prior_late_rate: scenario.sellerPriorLateRate,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return JSON.stringify(data);
        }

        return JSON.stringify({
          status: 'UNAVAILABLE',
          reason: 'MODEL_EXPLAIN_UNAVAILABLE',
        });
      } catch (err: any) {
        return JSON.stringify({
          status: 'UNAVAILABLE',
          reason: 'MODEL_EXPLAIN_UNREACHABLE',
        });
      }
    },
    {
      name: 'explain_delivery_delay',
      description: 'Obtiene la atribución de características SHAP para una predicción real.',
      schema: deliveryScenarioSchema.partial({ scenarioId: true }),
    },
  );

  return [getDeliveryPredictionScenarios, predictDeliveryDelay, explainDeliveryDelay];
}
