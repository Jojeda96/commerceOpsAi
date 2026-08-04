import { EvidenceMetric } from '@commerce-ops/shared-types';
import { ReviewComplaintAnalysisData } from './review-complaint-result.schema';

export function buildReviewComplaintMetrics(
  data: ReviewComplaintAnalysisData,
): EvidenceMetric[] {
  const metrics: EvidenceMetric[] = [];

  metrics.push({
    key: 'reviews.comments.total',
    label: 'Total rese&ntilde;as con comentario analizadas',
    value: data.totalCommentedReviews,
    unit: 'COUNT',
    sampleSize: data.totalCommentedReviews,
    sourcePath: 'totalCommentedReviews',
    aggregation: 'COUNT',
  });

  metrics.push({
    key: 'reviews.complaints.matched_total',
    label: 'Total rese&ntilde;as con quejas de taxonom&iacute;a',
    value: data.totalMatchedReviews,
    unit: 'COUNT',
    sampleSize: data.totalCommentedReviews,
    sourcePath: 'totalMatchedReviews',
    aggregation: 'COUNT',
  });

  for (const topicData of data.topics) {
    const topicKey = topicData.topic.toLowerCase();

    metrics.push({
      key: `reviews.topic.${topicKey}.count`,
      label: `Conteo de quejas de ${topicData.topic}`,
      value: topicData.uniqueReviewCount,
      unit: 'COUNT',
      sampleSize: data.totalCommentedReviews,
      sourcePath: `topics.${topicKey}.uniqueReviewCount`,
      aggregation: 'COUNT',
    });

    metrics.push({
      key: `reviews.topic.${topicKey}.share_pct`,
      label: `Porcentaje de quejas de ${topicData.topic}`,
      value: topicData.shareOfCommentedPct,
      unit: 'PERCENT',
      sampleSize: data.totalCommentedReviews,
      sourcePath: `topics.${topicKey}.shareOfCommentedPct`,
    });

    if (topicData.averageReviewScore !== null) {
      metrics.push({
        key: `reviews.topic.${topicKey}.avg_rating`,
        label: `Rating promedio de ${topicData.topic}`,
        value: topicData.averageReviewScore,
        unit: 'SCORE',
        sampleSize: topicData.uniqueReviewCount,
        sourcePath: `topics.${topicKey}.averageReviewScore`,
        aggregation: 'MEAN',
      });
    }

    for (const sub of topicData.subthemes) {
      const subKey = sub.code.toLowerCase();
      metrics.push({
        key: `reviews.subtheme.${subKey}.count`,
        label: `Conteo de subtema ${sub.code}`,
        value: sub.uniqueReviewCount,
        unit: 'COUNT',
        sampleSize: topicData.uniqueReviewCount,
        sourcePath: `topics.${topicKey}.subthemes.${subKey}.uniqueReviewCount`,
        aggregation: 'COUNT',
      });

      metrics.push({
        key: `reviews.subtheme.${subKey}.share_pct`,
        label: `Porcentaje de subtema ${sub.code}`,
        value: sub.shareWithinTopicPct,
        unit: 'PERCENT',
        sampleSize: topicData.uniqueReviewCount,
        sourcePath: `topics.${topicKey}.subthemes.${subKey}.shareWithinTopicPct`,
      });
    }
  }

  return metrics;
}
