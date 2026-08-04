export const mockReviewAnalysisResultFixture = {
  taxonomyVersion: 'v1.0.0',
  method: 'DETERMINISTIC_LEXICON_AGGREGATION' as const,
  totalCommentedReviews: 3,
  totalMatchedReviews: 3,
  topics: [
    {
      topic: 'DELIVERY_DELAY' as const,
      uniqueReviewCount: 2,
      shareOfCommentedPct: 66.67,
      averageReviewScore: 1.5,
      ratingDistribution: { '1': 1, '2': 1, '3': 0, '4': 0, '5': 0 },
      subthemes: [
        {
          code: 'LATE_DELIVERY',
          uniqueReviewCount: 2,
          shareWithinTopicPct: 100,
          examples: [
            {
              reviewId: 'rev-001',
              reviewScore: 1,
              originalText: 'O produto não chegou no prazo. Entrega muito atrasada e demorou 20 dias a mais.',
              matchedTerms: ['atrasada', 'demorou'],
              subthemes: ['LATE_DELIVERY'],
              scoreKind: 'LEXICON_MATCH' as const,
            },
          ],
        },
      ],
    },
    {
      topic: 'PACKAGE_DAMAGE' as const,
      uniqueReviewCount: 2,
      shareOfCommentedPct: 66.67,
      averageReviewScore: 1.5,
      ratingDistribution: { '1': 1, '2': 1, '3': 0, '4': 0, '5': 0 },
      subthemes: [
        {
          code: 'DAMAGED_PACKAGING',
          uniqueReviewCount: 2,
          shareWithinTopicPct: 100,
          examples: [
            {
              reviewId: 'rev-002',
              reviewScore: 1,
              originalText: 'Embalagem danificada e produto veio quebrado!',
              matchedTerms: ['embalagem danificada', 'quebrado'],
              subthemes: ['DAMAGED_PACKAGING', 'BROKEN_PRODUCT'],
              scoreKind: 'LEXICON_MATCH' as const,
            },
          ],
        },
      ],
    },
  ],
};
