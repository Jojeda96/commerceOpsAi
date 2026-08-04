import { PrismaService } from '../../database/prisma.service';
import { normalizeReviewText } from './review-text-normalizer';
import {
  REVIEW_COMPLAINT_TAXONOMY,
  REVIEW_COMPLAINT_TAXONOMY_VERSION,
  ComplaintTopic,
} from './review-complaint-taxonomy';
import {
  ReviewComplaintAnalysisData,
  ReviewExample,
  TopicResult,
  SubthemeResult,
} from './review-complaint-result.schema';
import { ToolResultEnvelope } from '@commerce-ops/shared-types';
import { buildReviewComplaintMetrics } from './review-complaint-metrics';

export interface AnalyzeReviewComplaintsInput {
  topics: ComplaintTopic[];
  dateFrom?: string;
  dateTo?: string;
  categories?: string[];
  minimumReviewScore?: number;
  maximumReviewScore?: number;
  examplesPerSubtheme?: number;
  scopeHash: string;
}

export class ReviewComplaintRepository {
  constructor(private readonly prisma: PrismaService) {}

  async analyzeReviewComplaints(
    input: AnalyzeReviewComplaintsInput,
  ): Promise<ToolResultEnvelope<ReviewComplaintAnalysisData>> {
    const {
      topics,
      dateFrom,
      dateTo,
      categories,
      minimumReviewScore,
      maximumReviewScore,
      examplesPerSubtheme = 3,
      scopeHash,
    } = input;

    const where: any = {
      reviewCommentMessage: {
        not: null,
      },
    };

    if (minimumReviewScore !== undefined || maximumReviewScore !== undefined) {
      where.reviewScore = {};
      if (minimumReviewScore !== undefined) where.reviewScore.gte = minimumReviewScore;
      if (maximumReviewScore !== undefined) where.reviewScore.lte = maximumReviewScore;
    }

    if (dateFrom || dateTo || (categories && categories.length > 0)) {
      where.order = {};
      if (dateFrom || dateTo) {
        where.order.orderPurchaseTimestamp = {};
        if (dateFrom) where.order.orderPurchaseTimestamp.gte = new Date(dateFrom);
        if (dateTo) where.order.orderPurchaseTimestamp.lte = new Date(dateTo);
      }
      if (categories && categories.length > 0) {
        where.order.items = {
          some: {
            product: {
              productCategoryName: { in: categories },
            },
          },
        };
      }
    }

    const dbReviews = await this.prisma.olistOrderReview.findMany({
      where,
      select: {
        reviewId: true,
        orderId: true,
        reviewScore: true,
        reviewCommentMessage: true,
        reviewCreationDate: true,
      },
    });

    const validReviews = dbReviews.filter(
      (r) => r.reviewCommentMessage && r.reviewCommentMessage.trim().length > 0,
    );

    const totalCommentedReviews = validReviews.length;

    if (totalCommentedReviews === 0) {
      return {
        status: 'NO_DATA',
        reasonCode: 'NO_REVIEW_COMMENTS_IN_SCOPE',
        scopeHash,
        appliedScope: { scopeHash } as any,
        rowCount: 0,
        sampleSize: 0,
        methods: ['REVIEW_LEXICON_AGGREGATION'],
        metrics: [],
        data: {
          taxonomyVersion: REVIEW_COMPLAINT_TAXONOMY_VERSION,
          method: 'DETERMINISTIC_LEXICON_AGGREGATION',
          totalCommentedReviews: 0,
          totalMatchedReviews: 0,
          topics: [],
        },
      };
    }

    const matchedReviewIdsSet = new Set<string>();
    const topicResults: TopicResult[] = [];

    for (const requestedTopic of topics) {
      const topicTaxonomy = REVIEW_COMPLAINT_TAXONOMY.find(
        (t) => t.topic === requestedTopic,
      );
      if (!topicTaxonomy) continue;

      const topicMatchedReviewsMap = new Map<
        string,
        {
          review: typeof validReviews[0];
          matchedTerms: Set<string>;
          subthemes: Set<string>;
        }
      >();

      const subthemeReviewsMap = new Map<
        string,
        Map<
          string,
          {
            review: typeof validReviews[0];
            matchedTerms: Set<string>;
          }
        >
      >();

      for (const subDef of topicTaxonomy.subthemes) {
        subthemeReviewsMap.set(subDef.code, new Map());
      }

      for (const rev of validReviews) {
        const norm = normalizeReviewText(rev.reviewCommentMessage);

        for (const subDef of topicTaxonomy.subthemes) {
          const matchedTermsInSub = new Set<string>();
          for (const term of subDef.terms) {
            const normTerm = normalizeReviewText(term);
            if (norm.includes(normTerm)) {
              matchedTermsInSub.add(term);
            }
          }

          if (matchedTermsInSub.size > 0) {
            matchedReviewIdsSet.add(rev.reviewId);

            if (!topicMatchedReviewsMap.has(rev.reviewId)) {
              topicMatchedReviewsMap.set(rev.reviewId, {
                review: rev,
                matchedTerms: new Set(),
                subthemes: new Set(),
              });
            }
            const tEntry = topicMatchedReviewsMap.get(rev.reviewId)!;
            matchedTermsInSub.forEach((tm) => tEntry.matchedTerms.add(tm));
            tEntry.subthemes.add(subDef.code);

            const subMap = subthemeReviewsMap.get(subDef.code)!;
            if (!subMap.has(rev.reviewId)) {
              subMap.set(rev.reviewId, { review: rev, matchedTerms: new Set() });
            }
            matchedTermsInSub.forEach((tm) =>
              subMap.get(rev.reviewId)!.matchedTerms.add(tm),
            );
          }
        }
      }

      const topicUniqueCount = topicMatchedReviewsMap.size;
      const shareOfCommentedPct =
        totalCommentedReviews > 0
          ? Math.round((topicUniqueCount / totalCommentedReviews) * 10000) / 100
          : 0;

      let scoreSum = 0;
      const ratingDist: Record<string, number> = {
        '1': 0,
        '2': 0,
        '3': 0,
        '4': 0,
        '5': 0,
      };

      topicMatchedReviewsMap.forEach(({ review }) => {
        scoreSum += review.reviewScore;
        const sKey = String(review.reviewScore);
        if (ratingDist[sKey] !== undefined) ratingDist[sKey]++;
      });

      const averageReviewScore =
        topicUniqueCount > 0
          ? Math.round((scoreSum / topicUniqueCount) * 100) / 100
          : null;

      const subthemesResultList: SubthemeResult[] = [];

      for (const subDef of topicTaxonomy.subthemes) {
        const subMap = subthemeReviewsMap.get(subDef.code)!;
        const subCount = subMap.size;
        const shareWithinTopicPct =
          topicUniqueCount > 0
            ? Math.round((subCount / topicUniqueCount) * 10000) / 100
            : 0;

        const candidateExamples: ReviewExample[] = Array.from(subMap.values()).map(
          ({ review, matchedTerms }) => ({
            reviewId: review.reviewId,
            reviewScore: review.reviewScore,
            originalText: review.reviewCommentMessage || '',
            matchedTerms: Array.from(matchedTerms),
            subthemes: [subDef.code],
            scoreKind: 'LEXICON_MATCH',
          }),
        );

        candidateExamples.sort((a, b) => {
          if (a.reviewScore !== b.reviewScore) {
            return a.reviewScore - b.reviewScore;
          }
          if (a.matchedTerms.length !== b.matchedTerms.length) {
            return b.matchedTerms.length - a.matchedTerms.length;
          }
          if (a.originalText.length !== b.originalText.length) {
            return b.originalText.length - a.originalText.length;
          }
          return a.reviewId.localeCompare(b.reviewId);
        });

        subthemesResultList.push({
          code: subDef.code,
          uniqueReviewCount: subCount,
          shareWithinTopicPct,
          examples: candidateExamples.slice(0, examplesPerSubtheme),
        });
      }

      topicResults.push({
        topic: requestedTopic,
        uniqueReviewCount: topicUniqueCount,
        shareOfCommentedPct,
        averageReviewScore,
        ratingDistribution: ratingDist,
        subthemes: subthemesResultList,
      });
    }

    const totalMatchedReviews = matchedReviewIdsSet.size;

    if (totalMatchedReviews === 0) {
      return {
        status: 'NO_DATA',
        reasonCode: 'NO_COMPLAINTS_MATCHED_TAXONOMY',
        scopeHash,
        appliedScope: { scopeHash } as any,
        rowCount: 0,
        sampleSize: totalCommentedReviews,
        methods: ['REVIEW_LEXICON_AGGREGATION'],
        metrics: [],
        data: {
          taxonomyVersion: REVIEW_COMPLAINT_TAXONOMY_VERSION,
          method: 'DETERMINISTIC_LEXICON_AGGREGATION',
          totalCommentedReviews,
          totalMatchedReviews: 0,
          topics: topicResults,
        },
      };
    }

    const analysisData: ReviewComplaintAnalysisData = {
      taxonomyVersion: REVIEW_COMPLAINT_TAXONOMY_VERSION,
      method: 'DETERMINISTIC_LEXICON_AGGREGATION',
      totalCommentedReviews,
      totalMatchedReviews,
      topics: topicResults,
    };

    const metrics = buildReviewComplaintMetrics(analysisData);

    return {
      status: 'AVAILABLE',
      scopeHash,
      appliedScope: { scopeHash } as any,
      rowCount: totalMatchedReviews,
      sampleSize: totalCommentedReviews,
      methods: ['REVIEW_LEXICON_AGGREGATION'],
      metrics,
      data: analysisData,
    };
  }
}
