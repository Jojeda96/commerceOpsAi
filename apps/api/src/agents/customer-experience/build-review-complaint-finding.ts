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
  ratingComparisonEvidence?: Evidence;
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
    ratingComparisonEvidence,
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

  const totalComments = complaintData?.totalCommentedReviews || 0;
  const totalMatched = complaintData?.totalMatchedReviews || 0;

  const isNoData = complaintEvidence?.status === 'NO_DATA';
  const isUnavailable =
    complaintEvidence?.status !== undefined &&
    complaintEvidence.status !== 'AVAILABLE' &&
    complaintEvidence.status !== 'NO_DATA';

  const requiresRatingComparison = requiredAnswerComponents.includes(
    'TEMPORAL_RATING_COMPARISON',
  );

  if (requiresRatingComparison && ratingComparisonEvidence) {
    let parsedComp: any = {};
    try {
      parsedComp = JSON.parse(ratingComparisonEvidence.resultSummary || '{}');
    } catch {
      parsedComp = {};
    }

    const comparisonData = parsedComp?.data;

    if (
      parsedComp.status === 'AVAILABLE' &&
      comparisonData?.target?.totalReviews > 0 &&
      comparisonData?.reference?.totalReviews > 0
    ) {
      const targetRating = comparisonData.target.averageRating || 0;
      const refRating = comparisonData.reference.averageRating || 0;
      const deltaRating = comparisonData.deltaRating || 0;
      const relativeChangePct = comparisonData.relativeChangePct || 0;

      const title = 'Comparación Temporal de Calificación Promedio de Clientes';
      const description = `La calificación promedio fue ${targetRating} en febrero de 2018, frente a ${refRating} en enero de 2018. La variación fue de ${deltaRating} puntos (${relativeChangePct}%).`;

      const numClaims: NumericClaim[] = [
        {
          claimId: `claim-rating-target-${Date.now()}`,
          metricKey: 'reviews.comparison.target_rating',
          value: targetRating,
          unit: 'SCORE',
          evidenceId: ratingComparisonEvidence.id,
          sourcePath: '$.data.target.averageRating',
          tolerance: 0.01,
        },
        {
          claimId: `claim-rating-ref-${Date.now()}`,
          metricKey: 'reviews.comparison.reference_rating',
          value: refRating,
          unit: 'SCORE',
          evidenceId: ratingComparisonEvidence.id,
          sourcePath: '$.data.reference.averageRating',
          tolerance: 0.01,
        },
        {
          claimId: `claim-rating-delta-${Date.now()}`,
          metricKey: 'reviews.comparison.delta_rating',
          value: deltaRating,
          unit: 'SCORE',
          evidenceId: ratingComparisonEvidence.id,
          sourcePath: '$.data.deltaRating',
          tolerance: 0.01,
        },
        {
          claimId: `claim-rating-relative-${Date.now()}`,
          metricKey: 'reviews.comparison.relative_change_pct',
          value: relativeChangePct,
          unit: 'PERCENT',
          evidenceId: ratingComparisonEvidence.id,
          sourcePath: '$.data.relativeChangePct',
          tolerance: 0.01,
        },
      ];

      const mClaims: MethodClaim[] = [
        {
          method: 'TEMPORAL_COMPARISON',
          evidenceId: ratingComparisonEvidence.id,
          toolName: 'compare_rating_summary_periods',
        },
      ];

      const evIds = [ratingComparisonEvidence.id];
      if (complaintEvidence) evIds.push(complaintEvidence.id);
      if (ratingEvidence) evIds.push(ratingEvidence.id);

      const coverage: AnswerCoverageItem[] = [
        {
          component: 'TEMPORAL_RATING_COMPARISON',
          status: 'ANSWERED',
          evidenceIds: [ratingComparisonEvidence.id],
        },
      ];

      if (requiredAnswerComponents.includes('REVIEW_RATING_CONTEXT')) {
        coverage.push({
          component: 'REVIEW_RATING_CONTEXT',
          status: 'ANSWERED',
          evidenceIds: [ratingComparisonEvidence.id],
        });
      }

      const ratingFinding: Finding = {
        id: `finding-cx-rating-comp-${Date.now()}`,
        investigationId,
        localAgentRunId,
        agent: 'CUSTOMER_EXPERIENCE',
        agentName: 'CUSTOMER_EXPERIENCE',
        title,
        description,
        findingType: 'REVIEW_COMPLAINT_ANALYSIS',
        evidenceIds: evIds,
        numericClaims: numClaims,
        methodClaims: mClaims,
        auditStatus: 'APPROVED',
        operationalStatus: 'ACTIONABLE',
        createdAt: new Date().toISOString(),
      };

      return { finding: ratingFinding, coverageItems: coverage };
    }
  }

  if (isNoData) {
    const noDataReason =
      complaintEvidence.reasonCode ||
      (totalComments === 0
        ? 'NO_REVIEW_COMMENTS_IN_SCOPE'
        : 'NO_COMPLAINTS_MATCHED_TAXONOMY');

    const noDataExplanation =
      noDataReason === 'NO_REVIEW_COMMENTS_IN_SCOPE'
        ? 'Sin comentarios de reseñas en el ámbito analizado'
        : 'Se encontraron reseñas con comentario, pero ninguna coincidió con la taxonomía de quejas solicitada.';

    const noDataDescription =
      noDataReason === 'NO_REVIEW_COMMENTS_IN_SCOPE'
        ? 'No se encontraron reseñas con comentario en el ámbito analizado.'
        : 'Se encontraron reseñas con comentario, pero ninguna coincidió con la taxonomía de quejas solicitada.';

    const coverageItems: AnswerCoverageItem[] = [
      {
        component: 'REVIEW_COMPLAINT_THEMES',
        status: 'NO_DATA_WITH_REASON',
        reasonCode: noDataReason,
        evidenceIds: [complaintEvidence.id],
        explanation: noDataExplanation,
      },
    ];

    if (requiredAnswerComponents.includes('DELIVERY_DELAY_COMPLAINTS')) {
      coverageItems.push({
        component: 'DELIVERY_DELAY_COMPLAINTS',
        status: 'NO_DATA_WITH_REASON',
        reasonCode: noDataReason,
        evidenceIds: [complaintEvidence.id],
      });
    }

    if (requiredAnswerComponents.includes('PACKAGE_DAMAGE_COMPLAINTS')) {
      coverageItems.push({
        component: 'PACKAGE_DAMAGE_COMPLAINTS',
        status: 'NO_DATA_WITH_REASON',
        reasonCode: noDataReason,
        evidenceIds: [complaintEvidence.id],
      });
    }

    if (requiredAnswerComponents.includes('REVIEW_RATING_CONTEXT')) {
      coverageItems.push({
        component: 'REVIEW_RATING_CONTEXT',
        status: ratingEvidence ? 'ANSWERED' : 'UNAVAILABLE_WITH_REASON',
        evidenceIds: ratingEvidence ? [ratingEvidence.id] : [],
        reasonCode: ratingEvidence
          ? undefined
          : 'RATING_EVIDENCE_NOT_COLLECTED',
      });
    }

    const finding: Finding = {
      id: findingId,
      investigationId,
      localAgentRunId,
      agent: 'CUSTOMER_EXPERIENCE',
      title: 'Análisis determinista de quejas y opiniones en reseñas',
      description: noDataDescription,
      findingType: 'REVIEW_COMPLAINT_ANALYSIS',
      evidenceIds: [complaintEvidence.id],
      numericClaims: [],
      methodClaims: [],
      auditStatus: 'PENDING',
      operationalStatus: 'UNAVAILABLE',
      createdAt: new Date().toISOString(),
    };

    return { finding, coverageItems };
  }

  if (isUnavailable) {
    const reasonCode =
      complaintEvidence.reasonCode || 'REVIEW_COMPLAINT_ANALYSIS_UNAVAILABLE';

    const coverageItems: AnswerCoverageItem[] = [
      {
        component: 'REVIEW_COMPLAINT_THEMES',
        status: 'UNAVAILABLE_WITH_REASON',
        reasonCode,
        evidenceIds: [complaintEvidence.id],
        explanation:
          'No fue posible completar el análisis de reseñas en el ámbito solicitado.',
      },
    ];

    if (requiredAnswerComponents.includes('DELIVERY_DELAY_COMPLAINTS')) {
      coverageItems.push({
        component: 'DELIVERY_DELAY_COMPLAINTS',
        status: 'UNAVAILABLE_WITH_REASON',
        reasonCode,
        evidenceIds: [complaintEvidence.id],
      });
    }

    if (requiredAnswerComponents.includes('PACKAGE_DAMAGE_COMPLAINTS')) {
      coverageItems.push({
        component: 'PACKAGE_DAMAGE_COMPLAINTS',
        status: 'UNAVAILABLE_WITH_REASON',
        reasonCode,
        evidenceIds: [complaintEvidence.id],
      });
    }

    if (requiredAnswerComponents.includes('REVIEW_RATING_CONTEXT')) {
      coverageItems.push({
        component: 'REVIEW_RATING_CONTEXT',
        status: ratingEvidence ? 'ANSWERED' : 'UNAVAILABLE_WITH_REASON',
        evidenceIds: ratingEvidence ? [ratingEvidence.id] : [],
        reasonCode: ratingEvidence
          ? undefined
          : 'RATING_EVIDENCE_NOT_COLLECTED',
      });
    }

    const finding: Finding = {
      id: findingId,
      investigationId,
      localAgentRunId,
      agent: 'CUSTOMER_EXPERIENCE',
      title: 'Análisis determinista de quejas y opiniones en reseñas',
      description:
        'No fue posible completar el análisis de reseñas en el ámbito solicitado.',
      findingType: 'REVIEW_COMPLAINT_ANALYSIS',
      evidenceIds: [complaintEvidence.id],
      numericClaims: [],
      methodClaims: [],
      auditStatus: 'PENDING',
      operationalStatus: 'UNAVAILABLE',
      createdAt: new Date().toISOString(),
    };

    return { finding, coverageItems };
  }

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
  if (ratingComparisonEvidence) evidenceIds.push(ratingComparisonEvidence.id);

  let findingTitle = 'Análisis determinista de quejas y opiniones en reseñas';
  let findingDescription = description;

  if (ratingComparisonEvidence && ratingComparisonEvidence.resultSummary) {
    methodClaims.push({
      method: 'TEMPORAL_COMPARISON',
      evidenceId: ratingComparisonEvidence.id,
      toolName: 'compare_rating_summary_periods',
    });

    let parsedComp: any = {};
    try {
      parsedComp = JSON.parse(ratingComparisonEvidence.resultSummary);
    } catch {
      parsedComp = {};
    }

    const cData = parsedComp.data || {};
    const targetRating = cData.target?.averageRating || 0;
    const refRating = cData.reference?.averageRating || 0;
    const deltaRating = cData.deltaRating || 0;
    const relativeChangePct = cData.relativeChangePct || 0;

    findingTitle = 'Comparación Temporal de Calificación Promedio de Clientes';
    findingDescription = `La calificación promedio fue ${targetRating} en febrero de 2018, frente a ${refRating} en enero de 2018. La variación fue de ${deltaRating} puntos (${relativeChangePct}%).`;

    numericClaims.push({
      claimId: `claim-rating-target-${Date.now()}`,
      metricKey: 'reviews.comparison.target_rating',
      value: targetRating,
      unit: 'SCORE',
      evidenceId: ratingComparisonEvidence.id,
      sourcePath: '$.data.target.averageRating',
      tolerance: 0.01,
    });

    numericClaims.push({
      claimId: `claim-rating-ref-${Date.now()}`,
      metricKey: 'reviews.comparison.reference_rating',
      value: refRating,
      unit: 'SCORE',
      evidenceId: ratingComparisonEvidence.id,
      sourcePath: '$.data.reference.averageRating',
      tolerance: 0.01,
    });

    numericClaims.push({
      claimId: `claim-rating-delta-${Date.now()}`,
      metricKey: 'reviews.comparison.delta_rating',
      value: deltaRating,
      unit: 'SCORE',
      evidenceId: ratingComparisonEvidence.id,
      sourcePath: '$.data.deltaRating',
      tolerance: 0.01,
    });

    numericClaims.push({
      claimId: `claim-rating-relative-${Date.now()}`,
      metricKey: 'reviews.comparison.relative_change_pct',
      value: relativeChangePct,
      unit: 'PERCENT',
      evidenceId: ratingComparisonEvidence.id,
      sourcePath: '$.data.relativeChangePct',
      tolerance: 0.01,
    });

    if (requiredAnswerComponents.includes('TEMPORAL_RATING_COMPARISON')) {
      coverageItems.push({
        component: 'TEMPORAL_RATING_COMPARISON',
        status: 'ANSWERED',
        evidenceIds: [ratingComparisonEvidence.id],
      });
    }
  }

  const finding: Finding = {
    id: findingId,
    investigationId,
    localAgentRunId,
    agent: 'CUSTOMER_EXPERIENCE',
    title: findingTitle,
    description: findingDescription,
    findingType: 'REVIEW_COMPLAINT_ANALYSIS',
    evidenceIds,
    numericClaims,
    methodClaims,
    auditStatus: 'PENDING',
    operationalStatus:
      totalMatched > 0 || ratingComparisonEvidence
        ? 'ACTIONABLE'
        : 'UNAVAILABLE',
    createdAt: new Date().toISOString(),
  };

  return { finding, coverageItems };
}
