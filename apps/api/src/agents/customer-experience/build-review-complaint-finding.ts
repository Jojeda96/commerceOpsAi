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

// Human-readable labels for subtheme codes
const SUBTHEME_LABELS: Record<string, string> = {
  NOT_DELIVERED: 'Pedido no recibido',
  LATE_DELIVERY: 'Entrega tardía',
  DEADLINE_MISSED: 'Plazo de entrega incumplido',
  BROKEN_PRODUCT: 'Producto quebrado',
  DAMAGED_PRODUCT: 'Producto dañado',
  DAMAGED_PACKAGING: 'Embalaje o caja dañada',
};

const formatCount = (value: number) =>
  new Intl.NumberFormat('es-CL').format(value);

const formatPct = (value: number) =>
  new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

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
    renderedTextFragment: `${formatCount(totalComments)} reseñas con comentario`,
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
    renderedTextFragment: `${formatCount(totalMatched)} reseñas con quejas`,
  });

  const delayTopic = complaintData.topics.find(
    (t) => t.topic === 'DELIVERY_DELAY',
  );
  const damageTopic = complaintData.topics.find(
    (t) => t.topic === 'PACKAGE_DAMAGE',
  );

  const delayCount = delayTopic ? delayTopic.uniqueReviewCount : 0;
  const delayShare = delayTopic ? delayTopic.shareOfCommentedPct : 0;
  const damageCount = damageTopic ? damageTopic.uniqueReviewCount : 0;
  const damageShare = damageTopic ? damageTopic.shareOfCommentedPct : 0;

  // Sort subthemes descending by uniqueReviewCount (ties broken alphabetically)
  const sortedDelaySubthemes = delayTopic
    ? [...delayTopic.subthemes].sort(
        (a, b) =>
          b.uniqueReviewCount - a.uniqueReviewCount ||
          a.code.localeCompare(b.code),
      )
    : [];

  const sortedDamageSubthemes = damageTopic
    ? [...damageTopic.subthemes].sort(
        (a, b) =>
          b.uniqueReviewCount - a.uniqueReviewCount ||
          a.code.localeCompare(b.code),
      )
    : [];

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
      renderedTextFragment: `${formatCount(delayCount)} reseñas relacionadas con demoras`,
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
      renderedTextFragment: `${formatPct(delayShare)} % de los comentarios`,
    });

    for (const sub of sortedDelaySubthemes) {
      numericClaims.push({
        claimId: `claim-subtheme-${sub.code}-${Date.now()}`,
        metricKey: `reviews.subtheme.${sub.code.toLowerCase()}.count`,
        value: sub.uniqueReviewCount,
        unit: 'COUNT',
        evidenceId: complaintEvidence.id,
        sourcePath: `topics.delivery_delay.subthemes.${sub.code.toLowerCase()}.uniqueReviewCount`,
        tolerance: 0,
        sampleSize: delayCount,
        renderedTextFragment: `${SUBTHEME_LABELS[sub.code] || sub.code} (${formatCount(sub.uniqueReviewCount)} reseñas)`,
      });
    }
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
      renderedTextFragment: `${formatCount(damageCount)} reseñas relacionadas con daños`,
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
      renderedTextFragment: `${formatPct(damageShare)} % de los comentarios`,
    });

    for (const sub of sortedDamageSubthemes) {
      numericClaims.push({
        claimId: `claim-subtheme-${sub.code}-${Date.now()}`,
        metricKey: `reviews.subtheme.${sub.code.toLowerCase()}.count`,
        value: sub.uniqueReviewCount,
        unit: 'COUNT',
        evidenceId: complaintEvidence.id,
        sourcePath: `topics.package_damage.subthemes.${sub.code.toLowerCase()}.uniqueReviewCount`,
        tolerance: 0,
        sampleSize: damageCount,
        renderedTextFragment: `${SUBTHEME_LABELS[sub.code] || sub.code} (${formatCount(sub.uniqueReviewCount)} reseñas)`,
      });
    }
  }

  const descriptionLines: string[] = [];
  descriptionLines.push(
    `Se analizaron ${formatCount(totalComments)} reseñas con comentario en el scope asignado.`,
  );
  descriptionLines.push(
    `Las quejas relacionadas con demoras aparecieron en ${formatCount(delayCount)} reseñas (${formatPct(delayShare)} % de los comentarios analizados), mientras que las relacionadas con paquetes o productos dañados aparecieron en ${formatCount(damageCount)} (${formatPct(damageShare)} %).`,
  );

  if (sortedDelaySubthemes.length > 0) {
    const subNames = sortedDelaySubthemes
      .map(
        (s) =>
          `${SUBTHEME_LABELS[s.code] || s.code} (${formatCount(s.uniqueReviewCount)} reseñas)`,
      )
      .join(', ');
    descriptionLines.push(
      `Dentro de las quejas de demora, los subtemas más frecuentes fueron: ${subNames}.`,
    );
    const examples = sortedDelaySubthemes.flatMap((s) => s.examples);
    if (examples.length > 0) {
      const quote = examples[0].originalText;
      descriptionLines.push(
        `Ejemplo real de cliente sobre demoras: "${quote}"`,
      );
    }
  }

  if (sortedDamageSubthemes.length > 0) {
    const subNames = sortedDamageSubthemes
      .map(
        (s) =>
          `${SUBTHEME_LABELS[s.code] || s.code} (${formatCount(s.uniqueReviewCount)} reseñas)`,
      )
      .join(', ');
    descriptionLines.push(
      `Dentro de las quejas por daño, los subtemas más frecuentes fueron: ${subNames}.`,
    );
    const examples = sortedDamageSubthemes.flatMap((s) => s.examples);
    if (examples.length > 0) {
      const quote = examples[0].originalText;
      descriptionLines.push(`Ejemplo real de cliente sobre daños: "${quote}"`);
    }
  }

  descriptionLines.push(
    `Nota metodológica: Los temas se clasificaron determinísticamente mediante taxonomía de léxico versionada ${complaintData.taxonomyVersion}. Los comentarios describen problemas observados pero no demuestran causalidad operacional sobre el proceso de embalaje o transporte.`,
  );

  descriptionLines.push(
    `Nota sobre solapamiento: Una misma reseña puede pertenecer a más de un subtema; por eso la suma de subtemas puede superar el total único del tema.`,
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
      reasonCode:
        delayCount > 0 ? undefined : 'NO_DELIVERY_DELAY_COMPLAINTS_IN_SCOPE',
    });
  }

  if (requiredAnswerComponents.includes('PACKAGE_DAMAGE_COMPLAINTS')) {
    coverageItems.push({
      component: 'PACKAGE_DAMAGE_COMPLAINTS',
      status: damageCount > 0 ? 'ANSWERED' : 'NO_DATA_WITH_REASON',
      evidenceIds: [complaintEvidence.id],
      reasonCode:
        damageCount > 0 ? undefined : 'NO_PACKAGE_DAMAGE_COMPLAINTS_IN_SCOPE',
    });
  }

  if (requiredAnswerComponents.includes('REVIEW_RATING_CONTEXT')) {
    coverageItems.push({
      component: 'REVIEW_RATING_CONTEXT',
      status: ratingEvidence ? 'ANSWERED' : 'UNAVAILABLE_WITH_REASON',
      evidenceIds: ratingEvidence ? [ratingEvidence.id] : [],
      reasonCode: ratingEvidence ? undefined : 'RATING_EVIDENCE_NOT_COLLECTED',
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
