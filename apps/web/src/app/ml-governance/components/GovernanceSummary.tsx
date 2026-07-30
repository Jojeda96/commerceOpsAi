'use client';

import type { MlMetricsV3, MlRuntimeStatus } from '../types';

interface Props {
  metrics: MlMetricsV3;
  runtime: MlRuntimeStatus | null;
}

const STATUS_COLORS: Record<string, string> = {
  APPROVED_FOR_DEMO_INFERENCE: 'var(--color-accent-success, #22c55e)',
  EXPERIMENTAL_NOT_APPROVED: 'var(--color-accent-warning, #f59e0b)',
  UNAVAILABLE: 'var(--color-accent-error, #ef4444)',
};

const STATUS_LABELS: Record<string, string> = {
  APPROVED_FOR_DEMO_INFERENCE: '🟢 APROBADO PARA DEMO',
  EXPERIMENTAL_NOT_APPROVED: '🟡 EXPERIMENTAL — NO APROBADO',
  UNAVAILABLE: '🔴 NO DISPONIBLE',
};

export function GovernanceSummary({ metrics, runtime }: Props) {
  const status = metrics.deployment_status;
  const color = STATUS_COLORS[status] ?? 'var(--color-text-muted)';
  const label = STATUS_LABELS[status] ?? status;
  const isBlocked = status !== 'APPROVED_FOR_DEMO_INFERENCE';

  const infoItems: Array<{ label: string; value: string }> = [
    { label: 'Champion', value: metrics.champion_model_name },
    { label: 'Versión modelo', value: metrics.model_version },
    {
      label: 'Familia',
      value: runtime?.model_family ?? 'N/A',
    },
    {
      label: 'Bundle schema',
      value: runtime?.bundle_schema_version ?? 'N/A',
    },
    {
      label: 'Feature contract',
      value: runtime?.feature_contract_version ?? metrics.features?.length ? `${metrics.features.length} features` : 'N/A',
    },
    {
      label: 'Entrenado',
      value: metrics.trained_at
        ? new Date(metrics.trained_at).toLocaleDateString('es-AR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
        : 'N/A',
    },
    {
      label: 'Runtime ready',
      value: runtime?.runtime_ready ? '✅ Sí' : runtime ? '❌ No' : '—',
    },
  ];

  return (
    <section aria-labelledby="summary-heading">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2
            id="summary-heading"
            style={{ fontSize: '1.1rem', fontWeight: 700 }}
          >
            Estado del Modelo
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Decisión de despliegue basada en quality gates automáticos
          </p>
        </div>
        <span
          style={{
            background: `${color}22`,
            border: `1px solid ${color}`,
            color,
            borderRadius: '8px',
            padding: '6px 14px',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          {label}
        </span>
      </div>

      {isBlocked && (
        <div
          style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.4)',
            borderLeft: '4px solid var(--color-accent-warning, #f59e0b)',
            borderRadius: '8px',
            padding: '14px 16px',
            marginTop: '16px',
          }}
        >
          <p style={{ fontWeight: 600, color: 'var(--color-accent-warning, #f59e0b)' }}>
            ⚠️ Modelo bloqueado por quality gate automático
          </p>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
            No supera los umbrales mínimos para inferencia operativa. La API responde HTTP 503.
            Los modelos bloqueados son válidos para análisis exploratorio bajo supervisión humana.
          </p>
          {metrics.deployment_reasons?.length > 0 && (
            <ul style={{ marginTop: '10px', paddingLeft: '18px', fontSize: '0.82rem' }}>
              {metrics.deployment_reasons.map((reason: string) => (
                <li key={reason} style={{ color: 'var(--color-text-muted)', marginBottom: '2px' }}>
                  <code style={{ background: 'rgba(0,0,0,0.2)', padding: '1px 4px', borderRadius: '3px' }}>
                    {reason}
                  </code>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '10px',
          marginTop: '20px',
        }}
      >
        {infoItems.map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              padding: '12px',
            }}
          >
            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {label}
            </p>
            <p style={{ fontWeight: 600, marginTop: '4px', fontSize: '0.9rem', wordBreak: 'break-all' }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '10px',
          marginTop: '16px',
        }}
      >
        {[
          { label: 'ROC-AUC (Test)', value: metrics.champion.final_test_metrics.roc_auc.toFixed(4), ci: metrics.roc_auc_ci_95 },
          { label: 'PR-AUC (Test)', value: metrics.champion.final_test_metrics.pr_auc.toFixed(4), sub: `${metrics.pr_auc_lift_over_prevalence.toFixed(2)}x lift` },
          { label: 'Precision', value: metrics.champion.final_test_metrics.precision.toFixed(4) },
          { label: 'Recall', value: metrics.champion.final_test_metrics.recall.toFixed(4) },
          { label: 'F1', value: metrics.champion.final_test_metrics.f1.toFixed(4) },
          { label: 'Brier Score', value: metrics.champion.final_test_metrics.brier_score.toFixed(4) },
          { label: 'Muestras test', value: (metrics.test_samples ?? metrics.sample_count ?? 0).toLocaleString() },
          { label: 'Prevalencia', value: `${((metrics.positive_ratio ?? 0) * 100).toFixed(2)}%` },
        ].map(({ label, value, ci, sub }) => (
          <div
            key={label}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              padding: '12px',
            }}
          >
            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
              {label}
            </p>
            <p style={{ fontWeight: 700, fontSize: '1.1rem', marginTop: '4px' }}>{value}</p>
            {ci && (
              <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                CI 95%: [{ci[0].toFixed(3)}, {ci[1].toFixed(3)}]
              </p>
            )}
            {sub && (
              <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{sub}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
