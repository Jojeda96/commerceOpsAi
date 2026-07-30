'use client';

import type { DriftReport, DriftFeature, CategoricalDriftFeature } from '../types';

interface Props {
  drift: DriftReport;
}

const LEVEL_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  HIGH: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: '🔴 HIGH' },
  MEDIUM: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: '🟡 MEDIUM' },
  LOW: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: '🟢 LOW' },
};

interface NumericRow {
  feature: string;
  data: DriftFeature;
}

interface CategoricalRow {
  feature: string;
  data: CategoricalDriftFeature;
}

function LevelBadge({ level }: { level: string }) {
  const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG['LOW'];
  return (
    <span
      style={{
        background: cfg.bg,
        color: cfg.color,
        borderRadius: '4px',
        padding: '1px 8px',
        fontSize: '0.72rem',
        fontWeight: 600,
      }}
    >
      {cfg.label}
    </span>
  );
}

export function DriftPanel({ drift }: Props) {
  const numericRows: NumericRow[] = Object.entries(drift.drift)
    .map(([feature, data]) => ({ feature, data }))
    .sort((a, b) => {
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return (order[a.data.drift_level] ?? 3) - (order[b.data.drift_level] ?? 3);
    });

  const categoricalRows: CategoricalRow[] = Object.entries(drift.categorical_drift)
    .map(([feature, data]) => ({ feature, data }))
    .sort((a, b) => {
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return (order[a.data.drift_level] ?? 3) - (order[b.data.drift_level] ?? 3);
    });

  const highCount = numericRows.filter((r) => r.data.drift_level === 'HIGH').length;
  const catHighCount = categoricalRows.filter((r) => r.data.drift_level === 'HIGH').length;

  return (
    <section aria-labelledby="drift-heading">
      <h2 id="drift-heading" style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>
        Drift y Errores de Generalización
      </h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
        Comparación entre distribución de entrenamiento y test. Contrato:{' '}
        <code style={{ fontSize: '0.8rem' }}>{drift.feature_contract_version}</code>
      </p>

      <div
        style={{
          background: 'rgba(99,102,241,0.06)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          fontSize: '0.82rem',
        }}
      >
        ⚠️ El drift no implica causalidad. Un drift HIGH en una feature no significa que esa
        feature sea responsable del gap de desempeño — puede ser correlacional o tener origen
        en factores estacionales o de negocio. Interpretación siempre requerida.
      </div>

      {highCount > 0 && (
        <div
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: '6px',
            padding: '10px 14px',
            marginBottom: '14px',
            fontSize: '0.83rem',
            color: 'var(--color-accent-error, #ef4444)',
          }}
        >
          ⚠️ {highCount} feature{highCount > 1 ? 's' : ''} numérica{highCount > 1 ? 's' : ''} con drift HIGH detectada{highCount > 1 ? 's' : ''}.
        </div>
      )}

      {/* Numeric drift */}
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '10px' }}>
        Features Numéricas — PSI y KS
      </h3>
      <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', textAlign: 'left' }}>
              {['Feature', 'PSI', 'KS stat', 'KS p-value', 'Δ media', 'Missing Δ', 'Nivel'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '8px 10px',
                    color: 'var(--color-text-muted)',
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {numericRows.map(({ feature, data }) => (
              <tr
                key={feature}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  background:
                    data.drift_level === 'HIGH'
                      ? 'rgba(239,68,68,0.04)'
                      : 'transparent',
                }}
              >
                <td style={{ padding: '7px 10px', fontWeight: 500 }}>
                  <code style={{ fontSize: '0.8rem' }}>{feature}</code>
                </td>
                <td style={{ padding: '7px 10px', fontFamily: 'monospace', textAlign: 'right' }}>
                  {data.psi.toFixed(4)}
                </td>
                <td style={{ padding: '7px 10px', fontFamily: 'monospace', textAlign: 'right' }}>
                  {data.ks_statistic.toFixed(4)}
                </td>
                <td style={{ padding: '7px 10px', fontFamily: 'monospace', textAlign: 'right' }}>
                  {data.ks_pvalue < 0.001 ? '<0.001' : data.ks_pvalue.toFixed(4)}
                </td>
                <td style={{ padding: '7px 10px', fontFamily: 'monospace', textAlign: 'right' }}>
                  {data.mean_diff > 0 ? '+' : ''}{data.mean_diff.toFixed(3)}
                </td>
                <td style={{ padding: '7px 10px', fontFamily: 'monospace', textAlign: 'right' }}>
                  {((data.missing_rate_test - data.missing_rate_train) * 100).toFixed(2)}%
                </td>
                <td style={{ padding: '7px 10px' }}>
                  <LevelBadge level={data.drift_level} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Categorical drift */}
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '10px' }}>
        Features Categóricas — Cardinalidad y Unseen Rate
      </h3>
      {catHighCount > 0 && (
        <div
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: '6px',
            padding: '8px 12px',
            marginBottom: '12px',
            fontSize: '0.82rem',
            color: 'var(--color-accent-error, #ef4444)',
          }}
        >
          ⚠️ {catHighCount} feature{catHighCount > 1 ? 's' : ''} categórica{catHighCount > 1 ? 's' : ''} con drift HIGH.
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', textAlign: 'left' }}>
              {['Feature', 'Cardinalidad train', 'Cardinalidad test', 'Unseen rate', 'Nivel'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '8px 10px',
                    color: 'var(--color-text-muted)',
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categoricalRows.map(({ feature, data }) => (
              <tr key={feature} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '7px 10px' }}>
                  <code style={{ fontSize: '0.8rem' }}>{feature}</code>
                </td>
                <td style={{ padding: '7px 10px', textAlign: 'right' }}>{data.cardinality_train}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right' }}>{data.cardinality_test}</td>
                <td style={{ padding: '7px 10px', fontFamily: 'monospace', textAlign: 'right' }}>
                  {(data.unseen_rate * 100).toFixed(2)}%
                </td>
                <td style={{ padding: '7px 10px' }}>
                  <LevelBadge level={data.drift_level} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
