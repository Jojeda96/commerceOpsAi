import { z } from 'zod';

export const ScenarioUnavailabilityReasonSchema = z.enum([
  'SNAPSHOT_TABLE_MISSING',
  'SNAPSHOT_TABLE_EMPTY',
  'SNAPSHOT_QUERY_FAILED',
  'SNAPSHOT_DATA_STALE',
  'NO_ROWS_IN_SCOPE',
  'NO_GROUP_MEETS_MINIMUM_SAMPLE',
  'MISSING_REQUIRED_FEATURES',
  'MODEL_SERVICE_UNREACHABLE',
  'MODEL_BLOCKED_BY_GOVERNANCE',
]);

export const ScenarioDiagnosticsSchema = z.object({
  tableExists: z.boolean(),
  totalSnapshotRows: z.number().nonnegative(),
  minPurchaseDate: z.string().nullable(),
  maxPurchaseDate: z.string().nullable(),
  latestGeneratedAt: z.string().nullable(),
  featureContractVersion: z.string().nullable(),
  rowsInRequestedScope: z.number().nonnegative(),
  rawOrdersInRequestedScope: z.number().nonnegative(),
  distinctGroupsBeforeMinimum: z.number().nonnegative(),
  groupsAfterMinimum: z.number().nonnegative(),
  rowsExcludedForInvalidFeatures: z.number().nonnegative(),
});

export type ScenarioUnavailabilityReason = z.infer<
  typeof ScenarioUnavailabilityReasonSchema
>;
export type ScenarioDiagnostics = z.infer<typeof ScenarioDiagnosticsSchema>;
