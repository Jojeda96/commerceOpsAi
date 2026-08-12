import { ChatOpenAI } from '@langchain/openai';
import {
  Recommendation,
  Finding,
  RecommendationKind,
} from '@commerce-ops/shared-types';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { StreamingService } from '../../streaming/streaming.service';
import { runAgentWithTrace } from '../../observability/agent-runner';
import { extractModelUsage } from '../../observability/usage';
import { validateRecommendation } from './recommendation-validator';
import { validateRecommendationSupport } from './recommendation-support-policy';

function getSupportedMetricKeys(
  recommendation: Recommendation,
  findings: Finding[],
): string[] {
  const supportedIds = new Set(recommendation.supportingFindingIds || []);

  return findings
    .filter((finding) => supportedIds.has(finding.id))
    .flatMap((finding) =>
      (finding.numericClaims || []).map((claim) => claim.metricKey),
    );
}

function chooseExpectedImpactMetric(
  recommendation: Recommendation,
  findings: Finding[],
): string | undefined {
  const metricKeys = getSupportedMetricKeys(recommendation, findings);

  if (metricKeys.length === 0) {
    return undefined;
  }

  const text =
    `${recommendation.title} ${recommendation.description}`.toLowerCase();

  // Seller
  if (
    metricKeys.includes('seller.late_rate_pct') &&
    /atras|tard|demora/.test(text)
  ) {
    return 'seller.late_rate_pct';
  }

  if (
    metricKeys.includes('seller.average_rating') &&
    /rating|calificaci[oó]n|satisfacci[oó]n/.test(text)
  ) {
    return 'seller.average_rating';
  }

  if (
    metricKeys.includes('seller.revenue') &&
    /venta|ingreso|revenue/.test(text)
  ) {
    return 'seller.revenue';
  }

  // Rating temporal
  if (
    metricKeys.includes('reviews.comparison.delta_rating') &&
    /rating|calificaci[oó]n|satisfacci[oó]n/.test(text)
  ) {
    return 'reviews.comparison.delta_rating';
  }

  // CX complaints
  if (
    metricKeys.includes('reviews.topic.package_damage.share_pct') &&
    /daño|embalaje|package/.test(text)
  ) {
    return 'reviews.topic.package_damage.share_pct';
  }

  if (
    metricKeys.includes('reviews.topic.delivery_delay.share_pct') &&
    /demora|retras|atras|entrega/.test(text)
  ) {
    return 'reviews.topic.delivery_delay.share_pct';
  }

  // Sales category
  const categoryRevenue = metricKeys.find(
    (key) => key.startsWith('sales.category.') && key.endsWith('.revenue'),
  );

  if (categoryRevenue && /categor|ingreso|venta/.test(text)) {
    return categoryRevenue;
  }

  // Logistics
  if (
    metricKeys.includes('delivery.aggregate.late_rate_pct') &&
    /atras|retras|entrega/.test(text)
  ) {
    return 'delivery.aggregate.late_rate_pct';
  }

  return metricKeys[0];
}

function alignExpectedImpact(
  recommendation: Recommendation,
  findings: Finding[],
): Recommendation & { kind: RecommendationKind } {
  const metricKey = chooseExpectedImpactMetric(recommendation, findings);
  const kind = recommendation.kind || 'HYPOTHESIS_TO_TEST';

  if (!metricKey) {
    return {
      ...recommendation,
      kind,
    };
  }

  return {
    ...recommendation,
    kind,
    expectedImpact:
      `Métrica histórica afectada: ${metricKey}. ` +
      'La magnitud futura requiere simulación cuantitativa.',
  };
}

export function createStrategyNode(streaming: StreamingService) {
  return async (state: CommerceOpsStateType) => {
    const { investigationId, userQuestion, findings, evidence, iteration } =
      state;
    const currentIteration = iteration || 1;
    const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    streaming.emit(investigationId, 'agent.started', { agent: 'STRATEGY' });

    const { result, trace: agentTrace } = await runAgentWithTrace({
      agentName: 'STRATEGY',
      iteration: currentIteration,
      investigationId,
      modelName,
      execute: async () => {
        const actionableFindings = findings.filter(
          (f: Finding) =>
            f.operationalStatus !== 'BLOCKED' &&
            f.operationalStatus !== 'EXPERIMENTAL_CONTEXT',
        );

        const experimentalFindings = findings.filter(
          (f: Finding) => f.operationalStatus === 'EXPERIMENTAL_CONTEXT',
        );

        const rawRecs: Recommendation[] = [];

        if (actionableFindings.length === 0) {
          console.warn(
            '[StrategyNode] No existen hallazgos accionables para respaldar recomendaciones operativas.',
          );
          return {
            result: [],
          };
        }

        const model = new ChatOpenAI({
          modelName,
          temperature: 0.3,
          apiKey: process.env.OPENAI_API_KEY,
        });

        const prompt = `Eres el Business Strategy Agent de CommerceOps AI.
Tu tarea es convertir hallazgos técnicos ACCIONABLES en recomendaciones empresariales priorizadas y epistémicamente transparentes.

Pregunta del usuario: "${userQuestion}"
Hallazgos ACCIONABLES:
${JSON.stringify(actionableFindings, null, 2)}

${
  experimentalFindings.length > 0
    ? `NOTA DE GOBERNANZA: Existen ${experimentalFindings.length} hallazgos experimentales no aprobados que NO deben ser utilizados para recomendaciones operativas.`
    : ''
}

REGLAS DE RIGOR METODOLÓGICO:
1. NO inventes cifras ni proyectes reducciones de % sin simulación.
2. NO utilices el término "tiempo real". Utiliza "monitoreo periódico" o "ejecución programada".
3. Clasifica la recomendación en una de estas clases:
   "EVIDENCE_BACKED_ACTION",
   "HYPOTHESIS_TO_TEST",
   "MONITORING_ACTION",
   "DATA_QUALITY_ACTION".
4. expectedImpact SOLO puede mencionar un metricKey que exista dentro de numericClaims de alguno de los hallazgos que respaldan la recomendación. Nunca reutilices una métrica de otro dominio.

Genera 2 recomendaciones ejecutivas en formato JSON estricto:
{
  "recommendations": [
    {
      "title": "Título estratégico",
      "description": "Descripción detallada de la acción recomendada.",
      "priority": "HIGH",
      "kind": "MONITORING_ACTION",
      "expectedImpact": "Métrica histórica afectada: <metricKey respaldado por el hallazgo>. La magnitud futura requiere simulación cuantitativa.",
      "assumptions": ["Los patrones históricos observados se mantienen."]
    }
  ]
}`;

        const actionableIds = new Set(actionableFindings.map((f) => f.id));
        let inputTokens: number | undefined;
        let outputTokens: number | undefined;

        try {
          const response = await model.invoke(prompt);
          const usage = extractModelUsage(response);
          inputTokens = usage.inputTokens;
          outputTokens = usage.outputTokens;

          const content =
            typeof response.content === 'string'
              ? response.content
              : JSON.stringify(response.content);
          const match = content.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed.recommendations)) {
              for (const item of parsed.recommendations) {
                const rawSupportIds = Array.isArray(item.supportingFindingIds)
                  ? item.supportingFindingIds
                  : Array.from(actionableIds);

                const validSupportIds = rawSupportIds.filter((id: string) =>
                  actionableIds.has(id),
                );

                const rec: Recommendation = {
                  id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  investigationId,
                  title: item.title || 'Recomendación operacional',
                  description:
                    item.description || 'Implementar monitoreo continuo.',
                  priority: item.priority || 'MEDIUM',
                  kind: item.kind || 'HYPOTHESIS_TO_TEST',
                  expectedImpact:
                    item.expectedImpact ||
                    'Métrica afectada según hallazgos accionables.',
                  supportingFindingIds:
                    validSupportIds.length > 0
                      ? validSupportIds
                      : Array.from(actionableIds),
                  assumptions: item.assumptions || [],
                  createdAt: new Date().toISOString(),
                };
                rawRecs.push(rec);
              }
            }
          }
        } catch (err) {
          console.warn('[StrategyNode] Error creating recommendations:', err);
        }

        if (rawRecs.length === 0 && actionableFindings.length > 0) {
          const fallbackMetric = actionableFindings
            .flatMap((finding) => finding.numericClaims || [])
            .map((claim) => claim.metricKey)[0];

          rawRecs.push({
            id: `rec-default-${Date.now()}`,
            investigationId,
            title:
              'Programar monitoreo periódico de la tasa mensual de atrasos',
            description:
              'Verificar tamaño muestral, estabilidad temporal y composición por vendedor/categoría.',
            priority: 'HIGH',
            kind: 'MONITORING_ACTION',
            expectedImpact: fallbackMetric
              ? `Métrica histórica afectada: ${fallbackMetric}. La magnitud futura requiere simulación cuantitativa.`
              : 'Impacto operativo sujeto a validación cuantitativa.',
            supportingFindingIds: Array.from(actionableIds),
            assumptions: ['Los datos históricos reflejan la tendencia actual.'],
            createdAt: new Date().toISOString(),
          });
        }

        // Pass through recommendation validator & support policy (V4.4)
        const validatedRecs: Recommendation[] = [];
        for (const raw of rawRecs) {
          const valRes = validateRecommendation(raw, findings, evidence);
          validatedRecs.push(valRes.recommendation);
        }

        // Build evidenceBasis for CX review findings with semantic separation (Rating vs Complaints)
        const complaintFindings = state.findings.filter((finding) =>
          (finding.numericClaims || []).some((claim) =>
            claim.metricKey.startsWith('reviews.topic.'),
          ),
        );

        const ratingComparisonFindings = state.findings.filter((finding) =>
          (finding.numericClaims || []).some((claim) =>
            claim.metricKey.startsWith('reviews.comparison.'),
          ),
        );

        const enrichedRecs = validatedRecs.map((rec: any) => {
          const textLower = `${rec.title} ${rec.description}`.toLowerCase();
          const isRatingRelated = /calificaci[oó]n|rating|satisfacci[oó]n/.test(
            textLower,
          );

          if (
            (!rec.evidenceBasis || rec.evidenceBasis.length === 0) &&
            isRatingRelated &&
            ratingComparisonFindings.length > 0
          ) {
            const ratingFinding = ratingComparisonFindings[0];
            const ratingClaims = (ratingFinding.numericClaims || []).filter(
              (claim) => claim.metricKey.startsWith('reviews.comparison.'),
            );
            const evidenceIds = [
              ...new Set(ratingClaims.map((claim) => claim.evidenceId)),
            ];

            rec = {
              ...rec,
              kind: textLower.includes('causa')
                ? 'HYPOTHESIS_TO_TEST'
                : rec.kind,
              evidenceBasis: evidenceIds.map((evidenceId) => ({
                evidenceId,
                findingId: ratingFinding.id,
                metricKeys: ratingClaims
                  .filter((claim) => claim.evidenceId === evidenceId)
                  .map((claim) => claim.metricKey),
                answerComponents: [
                  'REVIEW_RATING_CONTEXT',
                  'TEMPORAL_RATING_COMPARISON',
                ],
              })),
              supportingFindingIds: [
                ...new Set([
                  ...(rec.supportingFindingIds || []),
                  ratingFinding.id,
                ]),
              ],
            };
          } else if (!rec.evidenceBasis || rec.evidenceBasis.length === 0) {
            const isReviewRelated =
              textLower.includes('review') ||
              textLower.includes('reseña') ||
              textLower.includes('queja') ||
              textLower.includes('demora') ||
              textLower.includes('delay') ||
              textLower.includes('embalaje') ||
              textLower.includes('daño') ||
              textLower.includes('package');

            if (isReviewRelated && complaintFindings.length > 0) {
              const complaintEvidenceIds = complaintFindings.flatMap(
                (f) => f.evidenceIds || [],
              );
              const metricKeys: string[] = [
                'reviews.topic.delivery_delay.share_pct',
                'reviews.topic.delivery_delay.count',
                'reviews.comments.total',
              ];
              const answerComponents: string[] = [
                'REVIEW_COMPLAINT_THEMES',
                'DELIVERY_DELAY_COMPLAINTS',
              ];

              if (
                textLower.includes('embalaje') ||
                textLower.includes('daño') ||
                textLower.includes('package')
              ) {
                metricKeys.push('reviews.topic.package_damage.share_pct');
                metricKeys.push('reviews.topic.package_damage.count');
                answerComponents.push('PACKAGE_DAMAGE_COMPLAINTS');
              }

              rec = {
                ...rec,
                evidenceBasis: complaintEvidenceIds.map((evId: string) => ({
                  evidenceId: evId,
                  findingId: complaintFindings[0]?.id,
                  metricKeys,
                  answerComponents,
                })),
                supportingFindingIds: [
                  ...new Set([
                    ...(rec.supportingFindingIds || []),
                    ...complaintFindings.map((f) => f.id),
                  ]),
                ],
              };
            }
          }
          return rec;
        });

        const groundedRecs = enrichedRecs.map((rec) =>
          alignExpectedImpact(rec, findings),
        );

        const answeredComponents = (state.answerCoverage || [])
          .filter((c) => c.status === 'ANSWERED')
          .map((c) => c.component);
        const unavailableComponents = (state.answerCoverage || [])
          .filter(
            (c) =>
              c.status === 'UNAVAILABLE_WITH_REASON' ||
              c.status === 'UNANSWERED',
          )
          .map((c) => c.component);

        const supportValidation = validateRecommendationSupport({
          recommendations: groundedRecs,
          findings,
          answeredComponents,
          unavailableComponents,
        });

        const finalRecs = (
          supportValidation.acceptedRecommendations as Recommendation[]
        ).map((rec: any) => {
          if (Array.isArray(rec.supportingFindingIds)) {
            rec.supportingFindingIds = [
              ...new Set(rec.supportingFindingIds as string[]),
            ];
          }

          if (Array.isArray(rec.evidenceBasis)) {
            const basisMap = new Map<string, any>();
            for (const basis of rec.evidenceBasis) {
              const key = [
                basis.findingId || '',
                basis.evidenceId || '',
                ...(basis.metricKeys || []).slice().sort(),
              ].join('|');
              basisMap.set(key, basis);
            }
            rec.evidenceBasis = Array.from(basisMap.values());
          }

          return rec;
        });

        for (const rec of finalRecs) {
          streaming.emit(investigationId, 'recommendation.created', {
            agent: 'STRATEGY',
            recommendation: rec,
          });
        }

        return {
          result: finalRecs,
          inputTokens,
          outputTokens,
        };
      },
    });

    streaming.emit(investigationId, 'agent.completed', {
      agent: 'STRATEGY',
    });

    return {
      completedAgents: [...state.completedAgents, 'STRATEGY' as const],
      agentRunTraces: [agentTrace],
      recommendations: result,
    };
  };
}
