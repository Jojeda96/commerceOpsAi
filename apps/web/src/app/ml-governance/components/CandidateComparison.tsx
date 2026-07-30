'use client';

import type { MlMetricsV3, CandidateMetrics } from '../types';

interface Props {
  metrics: MlMetricsV3;
}

const CHAMPION_LABEL = '🏆 Champion';
const CANDIDATE_LABEL = 'Candidato';

export function CandidateComparison({ metrics }: Props) {
  const { champion, candidates, best_logistic_candidate, champion_model_name } = metrics;

  // Build unified rows: champion first, then candidates sorted by PR-AUC desc
  const rows: Array<{
    name: string;
    metrics: CandidateMetrics;
    isChampion: boolean;
    isBestLogistic: boolean;
  }> = Object.entries(candidates)
    .sort(([, a], [, b]) => b.pr_auc - a.pr_auc)
    .map(([name, m]) => ({
      name,
      metrics: m,
      isChampion: name === champion_model_name,
      isBestLogistic: name === best_logistic_candidate,
    }));

  const champFinalTest = champion.final_test_metrics;

  return (
    <section aria-labelledby="candidates-heading">
      <h2 id="candidates-heading" style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px' }}>
        Comparación de Candidatos
      </h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
        Métricas de validación temporal (walk-forward CV). Las métricas de test final solo se
        muestran para el champion — el test no se usa para selección.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.85rem',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.12)', textAlign: 'left' }}>
              {['Modelo', 'PR-AUC CV', 'ROC-AUC CV', 'Brier CV', 'Estado'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '10px 12px',
                    color: 'var(--color-text-muted)',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ name, metrics: m, isChampion, isBestLogistic }) => (
              <tr
                key={name}
                style={{
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: isChampion ? 'rgba(99,102,241,0.08)' : 'transparent',
                }}
              >
                <td style={{ padding: '10px 12px', fontWeight: isChampion ? 700 : 400 }}>
                  <span>{name}</span>
                  {isChampion && (
                    <span
                      style={{
                        marginLeft: '8px',
                        background: 'rgba(99,102,241,0.3)',
                        color: '#a5b4fc',
                        borderRadius: '4px',
                        padding: '1px 6px',
                        fontSize: '0.7rem',
                      }}
                    >
                      {CHAMPION_LABEL}
                    </span>
                  )}
                  {isBestLogistic && !isChampion && (
                    <span
                      style={{
                        marginLeft: '8px',
                        background: 'rgba(20,184,166,0.2)',
                        color: '#5eead4',
                        borderRadius: '4px',
                        padding: '1px 6px',
                        fontSize: '0.7rem',
                      }}
                    >
                      mejor logistic
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{m.pr_auc.toFixed(4)}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{m.roc_auc.toFixed(4)}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{m.brier_score.toFixed(4)}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span
                    style={{
                      background: isChampion ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '0.75rem',
                    }}
                  >
                    {isChampion ? CHAMPION_LABEL : CANDIDATE_LABEL}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Champion test metrics — only for champion */}
      <div
        style={{
          marginTop: '20px',
          background: 'rgba(99,102,241,0.06)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: '8px',
          padding: '16px',
        }}
      >
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '10px' }}>
          🏆 Test Final — {champion_model_name}
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
          El test final se evalúa solo una vez por versión candidata a release (INV-05). No se usa
          para elegir modelo, hiperparámetros ni threshold.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: '10px',
          }}
        >
          {[
            ['ROC-AUC', champFinalTest.roc_auc.toFixed(4)],
            ['PR-AUC', champFinalTest.pr_auc.toFixed(4)],
            ['Lift PR-AUC', `${champFinalTest.pr_auc_lift_over_prevalence.toFixed(3)}x`],
            ['Precision', champFinalTest.precision.toFixed(4)],
            ['Recall', champFinalTest.recall.toFixed(4)],
            ['F1', champFinalTest.f1.toFixed(4)],
            ['Brier', champFinalTest.brier_score.toFixed(4)],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '6px',
                padding: '10px',
                textAlign: 'center',
              }}
            >
              <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{label}</p>
              <p style={{ fontWeight: 700, marginTop: '4px', fontFamily: 'monospace' }}>{value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
