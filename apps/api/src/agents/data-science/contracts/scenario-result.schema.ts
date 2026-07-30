import { z } from 'zod';

export const scenarioDiscoveryDiagnosticsSchema = z.object({
  minOrders: z.number(),
  candidateOrders: z.number(),
  candidateGroupsBeforeMinimum: z.number(),
  candidateGroupsAfterMinimum: z.number(),
  excludedForMissingFeatures: z.number(),
  selectedScenarios: z.number(),
});

export const scenarioResultSchema = z.object({
  status: z.enum(['AVAILABLE', 'UNAVAILABLE', 'ERROR']),
  reasonCode: z.string().optional(),
  scenarios: z.array(z.record(z.string(), z.unknown())).default([]),
  diagnostics: scenarioDiscoveryDiagnosticsSchema.optional(),
  scopeHash: z.string(),
});

export type ScenarioResult = z.infer<typeof scenarioResultSchema>;
