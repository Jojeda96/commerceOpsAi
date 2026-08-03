import { z } from 'zod';
import { ToolResultEnvelopeSchema } from '../common/tool-result.schema';

export const AnomalyPointSchema = z.object({
  month: z.string(),
  lateRatePct: z.number().nonnegative(),
  sampleSize: z.number().nonnegative(),
  robustZScore: z.number(),
});

export const AnomalySeriesDataSchema = z.object({
  method: z.literal('ROBUST_Z_SCORE'),
  threshold: z.number().positive(),
  monthsEvaluated: z.number().nonnegative(),
  medianMonthlyLateRatePct: z.number().nonnegative(),
  mad: z.number().nonnegative(),
  anomalyCount: z.number().nonnegative(),
  anomalies: z.array(AnomalyPointSchema),
  series: z.array(AnomalyPointSchema).optional(),
});

export const AnomalyResultSchema = ToolResultEnvelopeSchema.extend({
  data: AnomalySeriesDataSchema.nullable(),
});
