import { z } from 'zod';

export const explanationResultSchema = z.object({
  status: z.enum(['AVAILABLE', 'UNAVAILABLE', 'ERROR']),
  explanationType: z.enum([
    'LOCAL_SHAP',
    'LOCAL_LINEAR_CONTRIBUTION',
    'UNAVAILABLE',
  ]),
  topFeatures: z
    .array(
      z.object({
        feature: z.string(),
        value: z.unknown(),
        contribution: z.number(),
      }),
    )
    .default([]),
  baseValue: z.number().optional(),
});

export type ExplanationResult = z.infer<typeof explanationResultSchema>;
