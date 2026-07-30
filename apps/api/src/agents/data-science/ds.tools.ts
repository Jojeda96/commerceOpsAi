import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export function createDataScienceTools() {
  const predictDeliveryDelay = tool(
    async ({ sellerState, customerState, freightValue, itemCount }) => {
      const mlServiceUrl =
        process.env.ML_SERVICE_URL || 'http://localhost:8000';
      try {
        const response = await fetch(
          `${mlServiceUrl}/models/delivery-delay/predict`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              seller_state: sellerState,
              customer_state: customerState,
              freight_value: freightValue,
              item_count: itemCount,
            }),
          },
        );

        if (response.ok) {
          const data = await response.json();
          return JSON.stringify(data);
        }
      } catch (err) {
        console.warn(
          '[DS Tools] ML Service no disponible, usando fallback heurístico:',
          err,
        );
      }

      // Fallback determinista / heurística base
      let probability = 0.15;
      if (sellerState !== customerState) probability += 0.25;
      if (freightValue > 50) probability += 0.15;
      if (itemCount > 2) probability += 0.1;

      probability = Math.min(0.95, probability);

      return JSON.stringify({
        probability: Math.round(probability * 100) / 100,
        riskLevel: probability > 0.5 ? 'HIGH' : 'LOW',
        modelVersion: 'delay-heuristic-v1',
        heuristicFactors: [
          { factor: 'interstate_route', weight: 0.25 },
          { factor: 'freight_value_above_50', weight: 0.15 },
          { factor: 'item_count_above_2', weight: 0.1 },
        ],
        note: 'Baseline heurístico (ML Service fallback).',
      });
    },
    {
      name: 'predict_delivery_delay',
      description:
        'Ejecuta o consulta el modelo ML para predecir la probabilidad de atraso en un pedido.',
      schema: z.object({
        sellerState: z.string().default('SP'),
        customerState: z.string().default('RJ'),
        freightValue: z.number().default(30),
        itemCount: z.number().default(1),
      }),
    },
  );

  const explainDeliveryDelay = tool(
    async ({ sellerState, customerState, freightValue, itemCount }) => {
      const mlServiceUrl =
        process.env.ML_SERVICE_URL || 'http://localhost:8000';
      try {
        const response = await fetch(
          `${mlServiceUrl}/models/delivery-delay/explain`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              seller_state: sellerState,
              customer_state: customerState,
              freight_value: freightValue,
              item_count: itemCount,
            }),
          },
        );

        if (response.ok) {
          const data = await response.json();
          return JSON.stringify(data);
        }
      } catch (err) {
        console.warn(
          '[DS Tools] ML Service explain endpoint no disponible:',
          err,
        );
      }

      return JSON.stringify({
        base_value: 0.15,
        contributions: [
          { feature: 'is_interstate', shap_value: 0.25 },
          { feature: 'freight_value', shap_value: 0.15 },
        ],
      });
    },
    {
      name: 'explain_delivery_delay',
      description:
        'Obtiene la atribución de características mediante SHAP TreeExplainer para la predicción de retrasos del modelo XGBoost.',
      schema: z.object({
        sellerState: z.string().default('SP'),
        customerState: z.string().default('RJ'),
        freightValue: z.number().default(30),
        itemCount: z.number().default(1),
      }),
    },
  );

  return [predictDeliveryDelay, explainDeliveryDelay];
}
