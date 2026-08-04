import {
  Finding,
  Evidence,
  NumericClaim,
  MethodClaim,
  AnswerCoverageItem,
  AnswerComponent,
} from '@commerce-ops/shared-types';
import { ReviewComplaintAnalysisData } from './review-complaint-result.schema';

export interface BuildReviewComplaintFindingInput {
  investigationId: string;
  localAgentRunId: string;
  complaintData: ReviewComplaintAnalysisData;
  complaintEvidence: Evidence;
  ratingEvidence?: Evidence;
  requiredAnswerComponents: AnswerComponent[];
}

export interface ReviewFindingResult {
  finding: Finding;
  coverageItems: AnswerCoverageItem[];
}

export function buildReviewComplaintFinding(
  input: BuildReviewComplaintFindingInput,
): ReviewFindingResult {
  const {
    investigationId,
    localAgentRunId,
    complaintData,
    complaintEvidence,
    ratingEvidence,
    requiredAnswerComponents,
  } = input;

  const findingId = `finding-cx-complaint-${Date.now()}`;
  const numericClaims: NumericClaim[] = [];
  const methodClaims: MethodClaim[] = [
    {
      method: 'REVIEW_LEXICON_AGGREGATION',
      evidenceId: complaintEvidence.id,
      toolName: 'analyze_review_complaints',
    },
  ];

  const totalComments = complaintData.totalCommentedReviews;
  const totalMatched = complaintData.totalMatchedReviews;

  numericClaims.push({
    claimId: `claim-comments-total-${Date.now()}`,
    metricKey: 'reviews.comments.total',
    value: totalComments,
    unit: 'COUNT',
    evidenceId: complaintEvidence.id,
    sourcePath: 'totalCommentedReviews',
    tolerance: 0,
    sampleSize: totalComments,
    renderedTextFragment: `${totalComments} reseñas con comentario`,
  });

  numericClaims.push({
    claimId: `claim-complaints-matched-${Date.now()}`,
    metricKey: 'reviews.complaints.matched_total',
    value: totalMatched,
    unit: 'COUNT',
    evidenceId: complaintEvidence.id,
    sourcePath: 'totalMatchedReviews',
    tolerance: 0,
    sampleSize: totalComments,
    renderedTextFragment: `${totalMatched} reseñas con quejas`,
  });

  const delayTopic = complaintData.topics.find((t) => t.topic === 'DELIVERY_DELAY');
  const damageTopic = complaintData.topics.find((t) => t.topic === 'PACKAGE_DAMAGE');

  const delayCount = delayTopic ? delayTopic.uniqueReviewCount : 0;
  const delayShare = delayTopic ? delayTopic.shareOfCommentedPct : 0;
  const damageCount = damageTopic ? damageTopic.uniqueReviewCount : 0;
  const damageShare = damageTopic ? damageTopic.shareOfCommentedPct : 0;

  if (delayTopic) {
    numericClaims.push({
      claimId: `claim-delay-count-${Date.now()}`,
      metricKey: 'reviews.topic.delivery_delay.count',
      value: delayCount,
      unit: 'COUNT',
      evidenceId: complaintEvidence.id,
      sourcePath: 'topics.delivery_delay.uniqueReviewCount',
      tolerance: 0,
      sampleSize: totalComments,
      renderedTextFragment: `${delayCount} reseñas relacionadas con demoras`,
    });
    numericClaims.push({
      claimId: `claim-delay-share-${Date.now()}`,
      metricKey: 'reviews.topic.delivery_delay.share_pct',
      value: delayShare,
      unit: 'PERCENT',
      evidenceId: complaintEvidence.id,
      sourcePath: 'topics.delivery_delay.shareOfCommentedPct',
      tolerance: 0.1,
      sampleSize: totalComments,
      renderedTextFragment: `${delayShare}% de los comentarios`,
    });
  }

  if (damageTopic) {
    numericClaims.push({
      claimId: `claim-damage-count-${Date.now()}`,
      metricKey: 'reviews.topic.package_damage.count',
      value: damageCount,
      unit: 'COUNT',
      evidenceId: complaintEvidence.id,
      sourcePath: 'topics.package_damage.uniqueReviewCount',
      tolerance: 0,
      sampleSize: totalComments,
      renderedTextFragment: `${damageCount} reseñas relacionadas con daños`,
    });
    numericClaims.push({
      claimId: `claim-damage-share-${Date.now()}`,
      metricKey: 'reviews.topic.package_damage.share_pct',
      value: damageShare,
      unit: 'PERCENT',
      evidenceId: complaintEvidence.id,
      sourcePath: 'topics.package_damage.shareOfCommentedPct',
      tolerance: 0.1,
      sampleSize: totalComments,
      renderedTextFragment: `${damageShare}% de los comentarios`,
    });
  }

  let descriptionLines: string[] = [];
  descriptionLines.push(
    `Se analizaron ${totalComments} reseñas con comentario en el scope asignado.`,
  );
  descriptionLines.push(
    `Las quejas relacionadas con demoras aparecieron en ${delayCount} reseñas (${delayShare}% de los comentarios analizados), mientras que las relacionadas con paquetes o productos dañados aparecieron en ${damageCount} (${damageShare}%).`,
  );

  if (delayTopic && delayTopic.subthemes.length > 0) {
    const subNames = delayTopic.subthemes
      .map((s) => `${s.code} (${s.uniqueReviewCount} reseñas)`)
      .join(', ');
    descriptionLines.push(
      `Dentro de las quejas de demora, los subtemas más frecuentes fueron: ${subNames}.`,
    );
    const examples = delayTopic.subthemes.flatMap((s) => s.examples);
    if (examples.length > 0) {
      const quote = examples[0].originalText;
      descriptionLines.push(`Ejemplo real de cliente sobre demoras: "${quote}"`);
    }
  }

  if (damageTopic && damageTopic.subthemes.length > 0) {
    const subNames = damageTopic.subthemes
      .map((s) => `${s.code} (${s.uniqueReviewCount} reseñas)`)
      .join(', ');
    descriptionLines.push(
      `Dentro de las quejas por daño, los subtemas más frecuentes fueron: ${subNames}.`,
    );
    const examples = damageTopic.subthemes.flatMap((s) => s.examples);
    if (examples.length > 0) {
      const quote = examples[0].originalText;
      descriptionLines.push(`Ejemplo real de cliente sobre daños: "${quote}"`);
    }
  }

  descriptionLines.push(
    `Nota metodológica: Los temas se clasificaron determinísticamente mediante taxonomía de léxico versionada ${complaintData.taxonomyVersion}. Los comentarios describen problemas observados pero no demuestran causalidad operacional sobre el proceso de embalaje o transporte.`,
  );

  const description = descriptionLines.join('\n\n');

  const coverageItems: AnswerCoverageItem[] = [
    {
      component: 'REVIEW_COMPLAINT_THEMES',
      status: 'ANSWERED',
      evidenceIds: [complaintEvidence.id],
      explanation: 'Clasificación determinista de temas realizada',
    },
  ];

  if (requiredAnswerComponents.includes('DELIVERY_DELAY_COMPLAINTS')) {
    coverageItems.push({
      component: 'DELIVERY_DELAY_COMPLAINTS',
      status: delayCount > 0 ? 'ANSWERED' : 'NO_DATA_WITH_REASON',
      evidenceIds: [complaintEvidence.id],
      reasonCode: delayCount > 0 ? undefined : 'NO_DELIVERY_DELAY_COMPLAINTS_IN_SCOPE',
    });
  }

  if (requiredAnswerComponents.includes('PACKAGE_DAMAGE_COMPLAINTS')) {
    coverageItems.push({
      component: 'PACKAGE_DAMAGE_COMPLAINTS',
      status: damageCount > 0 ? 'ANSWERED' : 'NO_DATA_WITH_REASON',
      evidenceIds: [complaintEvidence.id],
      reasonCode: damageCount > 0 ? undefined : 'NO_PACKAGE_DAMAGE_COMPLAINTS_IN_SCOPE',
    });
  }

  if (requiredAnswerComponents.includes('REVIEW_RATING_CONTEXT')) {
    coverageItems.push({
      component: 'REVIEW_RATING_CONTEXT',
      status: ratingEvidence ? 'ANSWERED' : 'UNAVAILABLE_WITH_REASON',
      evidenceIds: ratingEvidence ? [ratingEvidence.id] : [],
    });
  }

  const evidenceIds = [complaintEvidence.id];
  if (ratingEvidence) evidenceIds.push(ratingEvidence.id);

  const finding: Finding = {
    id: findingId,
    investigationId,
    localAgentRunId,
    agent: 'CUSTOMER_EXPERIENCE',
    title: 'Análisis determinista de quejas y opiniones en reseñas',
    description,
    findingType: 'REVIEW_COMPLAINT_ANALYSIS',
    evidenceIds,
    numericClaims,
    methodClaims,
    auditStatus: 'PENDING',
    operationalStatus: totalMatched > 0 ? 'ACTIONABLE' : 'UNAVAILABLE',
    createdAt: new Date().toISOString(),
  };

  return { finding, coverageItems };
}
