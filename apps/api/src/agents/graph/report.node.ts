import { FinalReport } from '@commerce-ops/shared-types';
import { CommerceOpsStateType } from '../state/commerce-ops-state';
import { StreamingService } from '../../streaming/streaming.service';

export function createReportNode(streaming: StreamingService) {
  return async (state: CommerceOpsStateType) => {
    const { investigationId, userQuestion, findings, evidence, recommendations, criticFeedback } = state;

    const lastCritic = criticFeedback[criticFeedback.length - 1];
    const score = lastCritic?.severity === 'LOW' ? 95 : 85;

    const report: FinalReport = {
      investigationId,
      executiveSummary: `Investigación sobre "${userQuestion}" completada con ${findings.length} hallazgo(s) y ${recommendations.length} recomendación(es) estratégicas.`,
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
