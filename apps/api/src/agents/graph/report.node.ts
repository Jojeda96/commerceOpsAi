import { FinalReport } from '@commerce-ops/shared-types';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { StreamingService } from '../../streaming/streaming.service';

export function createReportNode(streaming: StreamingService) {
  return async (state: CommerceOpsStateType) => {
    const {
      investigationId,
      userQuestion,
      findings,
      evidence,
      recommendations,
    } = state;

    const score = state.criticScore > 0 ? state.criticScore : 85;

    let summaryPrefix = `Investigación sobre "${userQuestion}" completada`;
    if (state.criticDecision === 'APPROVED') {
      summaryPrefix = `Investigación sobre "${userQuestion}" completada y aprobada exitosamente por el Evidence Critic.`;
    } else if (state.criticDecision === 'APPROVED_WITH_WARNINGS') {
      summaryPrefix = `Investigación sobre "${userQuestion}" completada con observaciones metodológicas menores.`;
    } else if (state.criticDecision === 'REJECTED') {
      summaryPrefix = `Investigación sobre "${userQuestion}" rechazada: los hallazgos no alcanzaron la calidad o evidencia requerida.`;
    } else if (
      state.requiresHumanReview ||
      state.criticDecision === 'REQUIRES_MORE_ANALYSIS'
    ) {
      summaryPrefix = `Investigación sobre "${userQuestion}" requiere revisión humana tras agotar las iteraciones de análisis automatizado.`;
    }

    const report: FinalReport = {
      investigationId,
      executiveSummary: `${summaryPrefix} Se registran ${findings.length} hallazgo(s) y ${recommendations.length} recomendación(es).`,
      keyFindings: findings,
      evidenceList: evidence,
      recommendations,
      limitations: [
        'El análisis se basa en datos históricos del dataset de Olist (2016-2018).',
        'Las recomendaciones deben validarse con capacidad logística actual.',
      ],
      qualityScore: score,
      generatedAt: new Date().toISOString(),
    };

    streaming.emit(investigationId, 'report.completed', {
      investigationId,
      qualityScore: score,
      findingsCount: findings.length,
      recommendationsCount: recommendations.length,
    });

    return {
      finalReport: report,
    };
  };
}
