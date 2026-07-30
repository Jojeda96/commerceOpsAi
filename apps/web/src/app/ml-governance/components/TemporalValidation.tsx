'use client';

import type { WalkForwardValidation, TemporalFold } from '../types';

interface Props {
  validation: WalkForwardValidation;
  testRocAuc: number;
  testPrAuc: number;
}

function formatDateRange(range: [string, string]): string {
  const fmt = (d: string) => d.slice(0, 10);
  return `${fmt(range[0])} → ${fmt(range[1])}`;
}

export function TemporalValidation({ validation, testRocAuc, testPrAuc }: Props) {
  const { folds, summary, n_folds, feature_contract_version, generated_at } = validation;
  const worstFold = folds.find((f) => f.fold === summary.worst_fold);

  // Compute gap between best CV fold and test
  const valTestGapRoc = Math.abs(summary.mean_roc_auc - testRocAuc);
  const valTestGapPr = Math.abs(summary.mean_pr_auc - testPrAuc);
  const highGap = valTestGapRoc > 0.1 || valTestGapPr > 0.05;

  return (
    <section aria-labelledby="temporal-heading">
      <h2 id="temporal-heading" style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>
        Validación Temporal (Walk-Forward CV)
      </h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '4px' }}>
        {n_folds} folds con separación temporal estricta. Contrato:{' '}
        <code style={{ fontSize: '0.8rem' }}>{feature_contract_version}</code>
      </p>
      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
        Generado: {new Date(generated_at).toLocaleString('es-AR')}
      </p>

      {highGap && (
        <div
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderLeft: '4px solid var(--color-accent-error, #ef4444)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
          }}
        >
          <p style={{ fontWeight: 600, color: 'var(--color-accent-error, #ef4444)', fontSize: '0.9rem' }}>
            ⚠️ Gap significativo entre validación y test
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
            ROC-AUC: CV media {summary.mean_roc_auc.toFixed(4)} vs Test {testRocAuc.toFixed(4)}{' '}
            (Δ {valTestGapRoc.toFixed(4)}) — PR-AUC: Δ {valTestGapPr.toFixed(4)}. Este gap
            sugiere generalización más débil en datos más recientes o drift estacional.
          </p>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', textAlign: 'left' }}>
              {['Fold', 'Train range', 'Validación range', 'Train N', 'Val N', 'Prevalencia', 'ROC-AUC', 'PR-AUC', 'Brier'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '8px 10px',
                    color: 'var(--color-text-muted)',
                    fontWeight: 600,
                    fontSize: '0.72rem',
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
            {folds.map((fold: TemporalFold) => {
              const isWorst = fold.fold === summary.worst_fold;
              return (
                <tr
                  key={fold.fold}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: isWorst ? 'rgba(239,68,68,0.06)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '8px 10px', fontWeight: isWorst ? 700 : 400 }}>
                    {fold.fold}
                    {isWorst && (
                      <span
                        style={{
                          marginLeft: '6px',
                          fontSize: '0.68rem',
                          color: 'var(--color-accent-error, #ef4444)',
                          background: 'rgba(239,68,68,0.15)',
                          borderRadius: '3px',
                          padding: '0 4px',
                        }}
                      >
                        peor
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    {formatDateRange(fold.train_range)}
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    {formatDateRange(fold.val_range)}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fold.train_samples.toLocaleString()}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>{fold.val_samples.toLocaleString()}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                    {(fold.prevalence * 100).toFixed(1)}%
                  </td>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', textAlign: 'right' }}>
                    {fold.roc_auc.toFixed(3)}
                  </td>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', textAlign: 'right' }}>
                    {fold.pr_auc.toFixed(3)}
                  </td>
                  <td style={{ padding: '8px 10px', fontFamily: 'monospace', textAlign: 'right' }}>
                    {fold.brier_score.toFixed(3)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: '10px',
          marginTop: '16px',
        }}
      >
        {[
          ['PR-AUC CV media', summary.mean_pr_auc.toFixed(4)],
          ['PR-AUC CV std', summary.std_pr_auc.toFixed(4)],
          ['PR-AUC CV min', summary.min_pr_auc.toFixed(4)],
          ['PR-AUC CV max', summary.max_pr_auc.toFixed(4)],
          ['ROC-AUC CV media', summary.mean_roc_auc.toFixed(4)],
          [`Test ROC-AUC`, testRocAuc.toFixed(4)],
          [`Test PR-AUC`, testPrAuc.toFixed(4)],
          ['Peor fold', `Fold ${summary.worst_fold}`],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px',
              padding: '10px',
            }}
          >
            <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{label}</p>
            <p style={{ fontWeight: 700, fontFamily: 'monospace', marginTop: '4px' }}>{value}</p>
          </div>
        ))}
      </div>

      {worstFold && (
        <div
          style={{
            marginTop: '16px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '0.82rem',
          }}
        >
          <strong>Peor fold (Fold {worstFold.fold}):</strong> prevalencia{' '}
          {(worstFold.prevalence * 100).toFixed(1)}% — ROC-AUC {worstFold.roc_auc.toFixed(3)} —
          PR-AUC {worstFold.pr_auc.toFixed(3)}. El worst-fold performance define el límite de
          confianza del modelo antes de selección final.
        </div>
      )}
    </section>
  );
}
