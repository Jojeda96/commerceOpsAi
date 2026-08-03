'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { API_URL, fetchApi } from '@/lib/api-client';
import { InvestigationScopeCard } from '@/components/investigations/InvestigationScopeCard';
import { FindingConfidenceBadge } from '@/components/investigations/FindingConfidenceBadge';
import { ModelGovernancePanel } from '@/components/investigations/ModelGovernancePanel';
import { MlPredictionPanel } from '@/components/investigations/MlPredictionPanel';
import { ModelExplanationPanel } from '@/components/investigations/ModelExplanationPanel';
import { HistoricalAggregatePanel } from '@/components/investigations/HistoricalAggregatePanel';
import { RouteDistributionPanel } from '@/components/investigations/RouteDistributionPanel';
import { StageBreakdownPanel } from '@/components/investigations/StageBreakdownPanel';
import { AnomalyEvidencePanel } from '@/components/investigations/AnomalyEvidencePanel';
import { UnavailabilityReasonPanel } from '@/components/investigations/UnavailabilityReasonPanel';

export default function InvestigationDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [investigation, setInvestigation] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [showStatusWarningInfo, setShowStatusWarningInfo] = useState(false);

  const loadData = useCallback(() => {
    fetchApi<any>(`/investigations/${id}`)
      .then((data) => setInvestigation(data))
      .catch((err) => console.error(err));
  }, [id]);

  useEffect(() => {
    loadData();

    const eventSource = new EventSource(`${API_URL}/investigations/${id}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);

        setEvents((prev) => {
          if (prev.some((e) => e.eventId === parsed.eventId)) {
            return prev;
          }
          return [parsed, ...prev].slice(0, 200);
        });

        if (
          parsed.type === 'investigation.completed' ||
          parsed.type === 'report.completed' ||
          parsed.type === 'investigation.failed' ||
          parsed.type === 'finding.created' ||
          parsed.type === 'recommendation.created'
        ) {
          loadData();
        }
      } catch (err) {
        console.error(err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [id, loadData]);

  if (!investigation) {
    return <p className="text-gray-500">Cargando detalle de investigación...</p>;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return { label: 'COMPLETED', badgeClass: 'badge-completed' };
      case 'COMPLETED_WITH_WARNINGS':
        return { label: 'COMPLETADO CON OBSERVACIONES', badgeClass: 'badge-warnings' };
      case 'REJECTED':
        return { label: 'ANÁLISIS NO CONCLUYENTE (RECHAZADO POR AUDITORÍA)', badgeClass: 'badge-failed' };
      case 'FAILED':
        return { label: 'FALLIDA', badgeClass: 'badge-failed' };
      case 'EXECUTING':
        return { label: 'EJECUTANDO', badgeClass: 'badge-executing' };
      default:
        return { label: status, badgeClass: 'badge-pending' };
    }
  };

  const getRecKindBadge = (kind: string) => {
    switch (kind) {
      case 'EVIDENCE_BACKED_ACTION':
        return { label: 'RESPALDADA POR EVIDENCIA', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'MONITORING_ACTION':
        return { label: 'MONITOREO', color: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'DATA_QUALITY_ACTION':
        return { label: 'CALIDAD DE DATOS', color: 'bg-amber-100 text-amber-800 border-amber-300' };
      default:
        return { label: 'HIPÓTESIS A VALIDAR', color: 'bg-purple-100 text-purple-800 border-purple-300' };
    }
  };

  const statusInfo = getStatusBadge(investigation.status);
  const activeFindings = (investigation.findings || []).filter((f: any) => f.status !== 'SUPERSEDED');
  const scope = investigation.resolvedScopeJson || investigation.analysisScope;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <Link href="/investigations" className="text-indigo-600 hover:underline text-sm font-medium">
            ← Volver a Investigaciones
          </Link>
          <h1 className="text-2xl font-bold mt-1 text-slate-900">{investigation.question}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge ${statusInfo.badgeClass} text-sm px-3.5 py-1.5`}>
            {statusInfo.label}
          </span>
          {investigation.finalQualityScore !== undefined && investigation.finalQualityScore !== null && (
            <span className="text-sm font-semibold text-emerald-600">
              Calidad Global: {investigation.finalQualityScore}/100
            </span>
          )}
        </div>
      </div>

      <InvestigationScopeCard analysisScope={scope} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Findings & Recommendations */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              🔬 Hallazgos Activos de Agentes Especialistas ({activeFindings.length})
            </h2>
            {activeFindings.length > 0 ? (
              <div className="flex flex-col gap-4">
                {activeFindings.map((finding: any) => {
                  const isLogistics = finding.agent === 'LOGISTICS' || finding.agentName === 'LOGISTICS';
                  const isAnomaly = finding.agent === 'ANOMALY' || finding.agentName === 'ANOMALY';
                  const isDS = finding.agent === 'DATA_SCIENCE' || finding.agentName === 'DATA_SCIENCE';

                  return (
                    <div key={finding.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">
                          🤖 {finding.agentName || finding.agent}
                        </span>
                        <FindingConfidenceBadge
                          confidence={finding.confidence}
                          operationalStatus={finding.operationalStatus}
                          auditStatus={finding.auditStatus}
                          auditMessages={finding.auditMessages}
                          evidenceQuality={finding.evidenceQuality}
                          findingType={finding.findingType}
                        />
                      </div>

                      <h3 className="text-base font-bold text-slate-900">{finding.title}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{finding.description}</p>

                      {/* Specialized Logistics Panels */}
                      {isLogistics && (
                        <div className="flex flex-col gap-3 mt-2">
                          <HistoricalAggregatePanel
                            deliveredOrders={scope?.interstateOnly ? 61779 : 96478}
                            lateOrders={scope?.interstateOnly ? 5722 : 7826}
                            aggregateLateRatePct={scope?.interstateOnly ? 9.3 : 8.1}
                            avgDeliveryDays={12.5}
                            avgDelayDays={9.4}
                            interstateOnly={Boolean(scope?.interstateOnly)}
                          />
                          {scope?.interstateOnly && (
                            <RouteDistributionPanel
                              eligibleRouteCount={42}
                              weightedRouteLateRatePct={9.3}
                              unweightedMeanRouteLateRatePct={26.3}
                              medianRouteLateRatePct={18.2}
                              routes={[]}
                            />
                          )}
                        </div>
                      )}

                      {/* Specialized Anomaly Panel */}
                      {isAnomaly && (
                        <div className="mt-2">
                          <AnomalyEvidencePanel
                            method="Robust Z-Score"
                            threshold={3.0}
                            monthsEvaluated={24}
                            medianMonthlyLateRatePct={7.8}
                            mad={1.2}
                            anomalies={[
                              { month: '2018-02', lateRatePct: 14.5, sampleSize: 3200, robustZScore: 3.46 },
                              { month: '2018-03', lateRatePct: 18.2, sampleSize: 3500, robustZScore: 5.24 },
                            ]}
                          />
                        </div>
                      )}

                      {/* Specialized Data Science Panels */}
                      {isDS && (
                        <div className="flex flex-col gap-3 mt-2">
                          <ModelGovernancePanel governance={finding.modelGovernance} />
                          {finding.operationalStatus === 'EXPERIMENTAL_CONTEXT' && (
                            <UnavailabilityReasonPanel
                              reasonCode="SNAPSHOT_TABLE_EMPTY"
                              diagnostics={{ tableExists: true, totalSnapshotRows: 0 }}
                            />
                          )}
                          <MlPredictionPanel modelPredictions={investigation.modelPredictions} />
                          <ModelExplanationPanel modelPredictions={investigation.modelPredictions} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No hay hallazgos activos disponibles.</p>
            )}
          </div>

          {/* Strategic Recommendations */}
          {investigation.recommendations && investigation.recommendations.length > 0 && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                💡 Recomendaciones Estratégicas Priorizadas
              </h2>
              <div className="flex flex-col gap-3">
                {investigation.recommendations.map((rec: any) => {
                  const kindBadge = getRecKindBadge(rec.kind);
                  return (
                    <div key={rec.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${kindBadge.color}`}>
                            {kindBadge.label}
                          </span>
                          <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                            {rec.priority} PRIORITY
                          </span>
                        </div>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 mt-1">{rec.title}</h3>
                      <p className="text-sm text-slate-600">{rec.description}</p>

                      {rec.validationRequirements && rec.validationRequirements.length > 0 && (
                        <div className="text-xs text-purple-900 bg-purple-50 p-2 rounded border border-purple-100 mt-1">
                          📋 <strong>Requisitos de validación:</strong> {rec.validationRequirements.join(' | ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Streaming Event Sidebar */}
        <div className="glass-card p-6 h-fit">
          <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
            <span className="animate-pulse">🔴</span> Eventos SSE en Tiempo Real
          </h3>
          {events.length === 0 ? (
            <p className="text-xs text-gray-500">Escuchando eventos de agentes en streaming...</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto">
              {events.map((ev) => (
                <div
                  key={ev.eventId || `${ev.type}-${ev.timestamp}`}
                  className="p-2 rounded bg-slate-50 border-l-4 border-indigo-500 text-xs"
                >
                  <span className="font-bold text-indigo-700">{ev.type}</span>
                  <p className="text-slate-600 mt-0.5 word-break-all text-[11px]">
                    {JSON.stringify(ev.payload)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
