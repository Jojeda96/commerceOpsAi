import { z } from 'zod';

export const MetricUnitSchema = z.enum([
  'COUNT',
  'PERCENT',
  'PROPORTION',
  'DAYS',
  'ROBUST_Z_SCORE',
  'KILOMETERS',
  'BRL',
  'BOOLEAN',
]);

export const AnalysisMethodSchema = z.enum([
  'DESCRIPTIVE_AGGREGATION',
  'ROUTE_AGGREGATION',
  'STAGE_BREAKDOWN',
  'ROBUST_Z_SCORE',
  'MODEL_INFERENCE',
  'LOCAL_SHAP',
  'LINEAR_CONTRIBUTION',
]);

export const EvidenceMetricSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number(),
  unit: MetricUnitSchema,
  sampleSize: z.number().optional(),
  sourcePath: z.string(),
  aggregation: z
    .enum([
      'COUNT',
      'WEIGHTED_RATE',
      'UNWEIGHTED_MEAN',
      'MEDIAN',
      'MEAN',
      'ROBUST_Z_SCORE',
    ])
    .optional(),
});

export const ToolResultStatusSchema = z.enum([
  'AVAILABLE',
  'NO_DATA',
  'INSUFFICIENT_DATA',
  'UNAVAILABLE',
  'ERROR',
]);

export const ScopeProvenanceEntrySchema = z.object({
  field: z.enum([
    'dateFrom',
    'dateTo',
    'categories',
    'sellerIds',
    'sellerStates',
    'customerStates',
    'interstateOnly',
  ]),
  source: z.enum([
    'REQUEST_DTO',
    'DETERMINISTIC_QUESTION_PARSER',
    'CRITIC_PATCH',
    'UNSPECIFIED',
  ]),
  rawText: z.string().optional(),
});

export const AnalysisScopeSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  categories: z.array(z.string()).optional(),
  sellerIds: z.array(z.string()).optional(),
  sellerStates: z.array(z.string()).optional(),
  customerStates: z.array(z.string()).optional(),
  interstateOnly: z.boolean(),
  provenance: z.array(ScopeProvenanceEntrySchema),
  scopeHash: z.string(),
});

export const ToolResultEnvelopeSchema = z.object({
  status: ToolResultStatusSchema,
  reasonCode: z.string().optional(),
  scopeHash: z.string().min(1, 'scopeHash is required'),
  appliedScope: AnalysisScopeSchema,
  rowCount: z.number().nonnegative(),
  sampleSize: z.number().nonnegative(),
  methods: z.array(AnalysisMethodSchema),
  metrics: z.array(EvidenceMetricSchema),
  data: z.unknown().nullable(),
  diagnostics: z.record(z.string(), z.unknown()).optional(),
});
