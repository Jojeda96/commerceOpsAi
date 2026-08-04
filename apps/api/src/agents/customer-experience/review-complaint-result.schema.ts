import { z } from 'zod';

export const reviewExampleSchema = z.object({
  reviewId: z.string(),
  reviewScore: z.number(),
  originalText: z.string(),
  matchedTerms: z.array(z.string()),
  subthemes: z.array(z.string()),
  retrievalScore: z.number().optional(),
  scoreKind: z.enum(['LEXICON_MATCH', 'SEMANTIC_SIMILARITY']),
});

export type ReviewExample = z.infer<typeof reviewExampleSchema>;

export const subthemeResultSchema = z.object({
  code: z.string(),
  uniqueReviewCount: z.number(),
  shareWithinTopicPct: z.number(),
  examples: z.array(reviewExampleSchema),
});

export type SubthemeResult = z.infer<typeof subthemeResultSchema>;

export const topicResultSchema = z.object({
  topic: z.enum(['DELIVERY_DELAY', 'PACKAGE_DAMAGE']),
  uniqueReviewCount: z.number(),
  shareOfCommentedPct: z.number(),
  averageReviewScore: z.number().nullable(),
  ratingDistribution: z.record(z.string(), z.number()),
  subthemes: z.array(subthemeResultSchema),
});

export type TopicResult = z.infer<typeof topicResultSchema>;

export const reviewComplaintAnalysisDataSchema = z.object({
  taxonomyVersion: z.string(),
  method: z.literal('DETERMINISTIC_LEXICON_AGGREGATION'),
  totalCommentedReviews: z.number(),
  totalMatchedReviews: z.number(),
  topics: z.array(topicResultSchema),
});

export type ReviewComplaintAnalysisData = z.infer<
  typeof reviewComplaintAnalysisDataSchema
>;
