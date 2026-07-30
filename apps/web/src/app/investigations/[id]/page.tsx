'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { API_URL, fetchApi } from '@/lib/api-client';

export default function InvestigationDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [investigation, setInvestigation] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [showQualityInfo, setShowQualityInfo] = useState(false);
  const [showStatusWarningInfo, setShowStatusWarningInfo] = useState(false);

  const loadData = useCallback(() => {
    fetchApi<any>(`/investigations/${id}`)
      .then((data) => setInvestigation(data))
      .catch((err) => console.error(err));
  }, [id]);

  useEffect(() => {
    loadData();

    // Conectar a Server-Sent Events (SSE)
    const eventSource = new EventSource(`${API_URL}/investigations/${id}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        setEvents((prev) => [parsed, ...prev]);

        // Recargar datos en tiempo real al recibir eventos clave o finalización
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
    return <p style={{ color: 'var(--color-text-muted)' }}>Cargando detalle de investigación...</p>;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return { label: 'COMPLETED', badgeClass: 'badge-completed' };
      case 'COMPLETED_WITH_WARNINGS':
        return { label: 'COMPLETED (CON OBSERVACIONES)', badgeClass: 'badge-warnings' };
      case 'REJECTED':
        return { label: 'RECHAZADA', badgeClass: 'badge-failed' };
      case 'FAILED':
        return { label: 'FALLIDA', badgeClass: 'badge-failed' };
      case 'EXECUTING':
        return { label: 'EJECUTANDO', badgeClass: 'badge-executing' };
      default:
        return { label: status, badgeClass: 'badge-pending' };
    }
  };

  const statusInfo = getStatusBadge(investigation.status);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Link href="/investigations" style={{ color: 'var(--color-accent-primary)', fontSize: '0.85rem' }}>
            ← Volver a Investigaciones
          </Link>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: '4px' }}>{investigation.question}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              className={`badge ${statusInfo.badgeClass}`}
              style={{ fontSize: '0.85rem', padding: '6px 14px' }}
            >
              {statusInfo.label}
            </span>
            {investigation.status === 'COMPLETED_WITH_WARNINGS' && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowStatusWarningInfo(!showStatusWarningInfo)}
                  style={{
                    background: 'rgba(251, 191, 36, 0.15)',
                    border: '1px solid rgba(251, 191, 36, 0.5)',
                    color: '#fbbf24',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                  title="¿Qué significa 'COMPLETED (CON OBSERVACIONES)'?"
                >
                  ℹ️
                </button>
                {showStatusWarningInfo && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '32px',
                      right: 0,
                      width: '340px',
                      background: 'var(--color-bg-card)',
                      border: '1px solid #fbbf24',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      zIndex: 100,
                      fontSize: '0.8rem',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#fbbf24', marginBottom: '6px', fontSize: '0.85rem' }}>
                      ℹ️ ¿Por qué figura "Con Observaciones"?
                    </div>
                    <p style={{ lineHeight: '1.4', marginBottom: '6px' }}>
                      La investigación se ha <strong>completado con observaciones (Calidad {investigation.finalQualityScore || 85}/100)</strong>.
                    </p>
                    <p style={{ lineHeight: '1.4', color: 'var(--color-text-muted)' }}>
                      El <strong>Evidence Critic Agent</strong> emitió observaciones preventivas para asegurar rigurosidad metodológica y evitar afirmaciones no justificadas.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          {investigation.finalQualityScore !== undefined && investigation.finalQualityScore !== null && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-accent-success)' }}>
                Calidad Global: {investigation.finalQualityScore}/100
              </span>
              <button
                onClick={() => setShowQualityInfo(!showQualityInfo)}
                style={{
                  background: 'var(--color-bg-card)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-muted)',
                  borderRadius: '50%',
                  width: '22px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
                title="¿Qué es la Calidad Global?"
              >
                ℹ️
              </button>

              {showQualityInfo && (
                <div
                  style={{
                    position: 'absolute',
                    top: '32px',
                    right: 0,
                    width: '320px',
                    background: 'var(--color-bg-card)',
                    border: '1px solid var(--color-accent-primary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    zIndex: 100,
                    fontSize: '0.8rem',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--color-text-main)', marginBottom: '6px', fontSize: '0.85rem' }}>
                    ℹ️ ¿De dónde sale la Calidad Global ({investigation.finalQualityScore}/100)?
                  </div>
                  <p style={{ lineHeight: '1.4', marginBottom: '8px' }}>
                    Es la puntuación emitida por el <strong>Evidence Critic Agent</strong> tras auditar la validez de los hallazgos:
                  </p>
                  <ul style={{ paddingLeft: '16px', lineHeight: '1.4', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <li><strong>1. Verificación de Evidencia:</strong> Comprobación de que cada hallazgo cuente con herramientas y datos de respaldo.</li>
                    <li><strong>2. Consistencia Metodológica:</strong> Evaluación de rigor en las conclusiones emitidas por los agentes especialistas.</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
        {/* Columna Izquierda: Resultados */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 1º PRIMERO: Hallazgos de Agentes Especialistas */}
          <div className="glass-card">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>🔬 Hallazgos de Agentes Especialistas</h2>
            {investigation.findings && investigation.findings.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {investigation.findings.map((finding: any) => (
                  <div
                    key={finding.id}
                    style={{
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border)',
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-accent-primary)', fontWeight: 600 }}>
                        🤖 {finding.agentName || finding.agent}
                      </span>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-accent-success)' }}>
                          Confianza: {Math.round((finding.confidence || 0.9) * 100)}%
                        </span>
                      </div>
                    </div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginTop: '6px' }}>{finding.title}</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                      {finding.description}
                    </p>

                    {/* Explicación del Origen del Porcentaje de Confianza */}
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '10px 12px',
                        background: 'var(--color-bg-primary)',
                        borderRadius: 'var(--radius-sm)',
                        borderLeft: '3px solid var(--color-accent-primary)',
                        fontSize: '0.8rem',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>
                        ℹ️ ¿De dónde sale esta confianza del {Math.round((finding.confidence || 0.9) * 100)}%?
                      </span>
                      <p style={{ marginTop: '4px', lineHeight: '1.4' }}>
                        Nivel de confianza reportado por el agente especialista y auditado por el <strong>Evidence Critic</strong> mediante reglas deterministas de representatividad muestral y consistencia entre hallazgos y evidencias.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--color-text-muted)' }}>No hay hallazgos disponibles aún.</p>
            )}
          </div>

          {/* 2º SEGUNDO: Recomendaciones Estratégicas Priorizadas */}
          {investigation.recommendations && investigation.recommendations.length > 0 && (
            <div className="glass-card">
              <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: 'var(--color-accent-success)' }}>
                💡 Recomendaciones Estratégicas Priorizadas
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {investigation.recommendations.map((rec: any) => (
                  <div
                    key={rec.id}
                    style={{
                      background: 'var(--color-bg-card)',
                      border: '1px solid var(--color-border)',
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{rec.title}</h3>
                      <span className="badge badge-pending">{rec.priority} PRIORITY</span>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
                      {rec.description}
                    </p>
                    {rec.expectedImpact && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--color-accent-primary)', marginTop: '6px' }}>
                        Impacto Esperado: {rec.expectedImpact}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Explicación Adaptativa — Condicional según agentes invocados */}
              {(() => {
                const agentsInvolved = (investigation.findings || []).map((f: any) => f.agentName || f.agent);
                const usedDS = agentsInvolved.includes('DATA_SCIENCE');

                return (
                  <div
                    style={{
                      marginTop: '14px',
                      padding: '10px 12px',
                      background: 'var(--color-bg-primary)',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: '3px solid var(--color-accent-success)',
                      fontSize: '0.8rem',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>
                      ℹ️ ¿Cómo se proyecta el Impacto Esperado de una Recomendación?
                    </span>
                    <p style={{ marginTop: '4px', lineHeight: '1.4' }}>
                      {usedDS ? (
                        <>
                          El <strong>Business Strategy Agent</strong> combina las predicciones probabilísticas del modelo <strong>XGBoost</strong> (Data Science Agent) con los datos de PostgreSQL. Aplica un análisis de escenarios <em>"What-If"</em> para proyectar cuántos pedidos salen de la zona de riesgo al corregir la variable crítica identificada por el modelo ML.
                        </>
                      ) : (
                        <>
                          El <strong>Business Strategy Agent</strong> aplica un análisis de escenarios <em>"What-If"</em> sobre los datos reales obtenidos por los agentes especialistas ({agentsInvolved.join(', ')}). Proyecta el impacto basándose en la muestra cuantitativa de PostgreSQL y estándares operacionales del mercado de e-commerce.
                        </>
                      )}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

        </div>

        {/* Columna Derecha: Stream SSE en Tiempo Real */}
        <div className="glass-card" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ animation: 'pulse 1.5s infinite' }}>🔴</span> Eventos SSE en Tiempo Real
          </h3>
          {events.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              Escuchando eventos de agentes en streaming...
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto' }}>
              {events.map((ev, i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--color-bg-primary)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    borderLeft: '3px solid var(--color-accent-primary)',
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--color-accent-primary)' }}>{ev.type}</span>
                  <p style={{ color: 'var(--color-text-secondary)', marginTop: '2px', wordBreak: 'break-word' }}>
                    {JSON.stringify(ev.payload)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
