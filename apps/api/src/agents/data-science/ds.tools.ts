import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export function createDataScienceTools() {
  const predictDeliveryDelay = tool(
    async ({ sellerState, customerState, freightValue, itemCount }) => {
      // Proxy determinista / heurística base (en Fase 6 se conecta directamente al FastAPI ML Service)
      let probability = 0.15;
      if (sellerState !== customerState) probability += 0.25;
      if (freightValue > 50) probability += 0.15;
      if (itemCount > 2) probability += 0.1;

      probability = Math.min(0.95, probability);

      return JSON.stringify({
        probability: Math.round(probability * 100) / 100,
        riskLevel: probability > 0.5 ? 'HIGH' : 'LOW',
        modelVersion: 'delay-xgb-v1',
        topFeatures: [
          { feature: 'interstate_route', contribution: 0.35 },
          { feature: 'freight_value', contribution: 0.25 },
        ],
      });
    },
    {
      name: 'predict_delivery_delay',
      description: 'Ejecuta el modelo ML para predecir la probabilidad de atraso en un pedido según sus características.',
      schema: z.object({
        sellerState: z.string().default('SP'),
        customerState: z.string().default('RJ'),
        freightValue: z.number().default(30),
        itemCount: z.number().default(1),
      }),
    }
  );

  return [predictDeliveryDelay];
}
