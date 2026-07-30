import { z } from 'zod';

export const predictionResultSchema = z.object({
  status: z.enum(['AVAILABLE', 'UNAVAILABLE', 'ERROR']),
  modelName: z.string().optional(),
  modelVersion: z.string().optional(),
  probability: z.number().optional(),
  threshold: z.number().optional(),
  predictedDelayed: z.boolean().optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  operationallyActionable: z.boolean().optional(),
  scenarioId: z.string().optional(),
});

export type PredictionResult = z.infer<typeof predictionResultSchema>;

export function isPersistablePrediction(value: unknown): boolean {
  const parsed = predictionResultSchema.safeParse(value);
  if (!parsed.success) return false;
  const p = parsed.data;
  return (
    p.status === 'AVAILABLE' &&
    typeof p.probability === 'number' &&
    Number.isFinite(p.probability) &&
    typeof p.threshold === 'number' &&
    Number.isFinite(p.threshold)
  );
}
