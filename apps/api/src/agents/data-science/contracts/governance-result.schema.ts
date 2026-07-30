import { z } from 'zod';

export const modelGovernanceResultSchema = z.object({
  status: z.enum(['AVAILABLE', 'UNAVAILABLE', 'ERROR']),
  modelName: z.string().optional(),
  modelVersion: z.string().optional(),
  deploymentStatus: z.string().optional(),
  operationallyActionable: z.boolean().default(false),
  qualityGateReasons: z.array(z.string()).default([]),
  testMetrics: z
    .object({
      rocAuc: z.number().optional(),
      prAuc: z.number().optional(),
      prevalence: z.number().optional(),
      prAucLift: z.number().optional(),
      precision: z.number().optional(),
      recall: z.number().optional(),
    })
    .optional(),
  runtimeLoaded: z.boolean().default(false),
});

export type ModelGovernanceResult = z.infer<typeof modelGovernanceResultSchema>;
