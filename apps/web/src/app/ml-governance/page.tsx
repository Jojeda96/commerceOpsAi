'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api-client';

export default function MLGovernancePage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApi<any>('/analytics/ml-metrics')
      .then((data) => {
        setMetrics(data);
        setLoading(false);
      })
      .catch((err) => {
        // Fallback a endpoint de ml-service
        fetch('http://localhost:8000/models/delivery-delay/metrics')
          .then((res) => res.json())
          .then((data) => {
            setMetrics(data);
            setLoading(false);
          })
          .catch((e) => {
            setError('No se pudo cargar la información del modelo ML');
            setLoading(false);
          });
      });
  }, []);

  if (loading) {
    return (
      <div className="glass-card">
        <h2>Gobernanza del Modelo ML</h2>
        <p style={{ color: 'var(--color-text-muted)' }}>Cargando métricas y Quality Gates del modelo...</p>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="glass-card">
        <h2>Gobernanza del Modelo ML</h2>
        <p style={{ color: 'var(--color-accent-error)' }}>{error || 'Métricas no disponibles.'}</p>
      </div>
    );
  }

  const isApproved = metrics.deployment_status === 'APPROVED_FOR_DEMO_INFERENCE';

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700 }}>Gobernanza del Modelo ML</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>
            Estado de evaluación, Quality Gates e inferencia del predictor de atrasos
          </p>
        </div>
        <span
          className={`badge badge-${isApproved ? 'completed' : 'failed'}`}
          style={{ fontSize: '1rem', padding: '8px 16px' }}
        >
          {isApproved ? '🟢 APROBADO PARA DEMO' : '🔴 EXPERIMENTAL NO APROBADO'}
        </span>
      </div>

      {!isApproved && (
        <div className="glass-card" style={{ borderLeft: '4px solid var(--color-accent-warning)', marginTop: '20px' }}>
          <h3 style={{ color: 'var(--color-accent-warning)', fontSize: '1.1rem' }}>
            ⚠️ Modelo Bloqueado por Quality Gate
          </h3>
          <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>
            El modelo actual ha sido bloqueado automáticamente para decisiones operativas por no superar los baselines o faltar lift representativo sobre la prevalencia. La API responde HTTP 503 por defecto.
          </p>
          {metrics.deployment_reasons && (
            <ul style={{ marginTop: '12px', paddingLeft: '20px', fontSize: '0.85rem' }}>
              {metrics.deployment_reasons.map((reason: string, idx: number) => (
                <li key={idx} style={{ color: 'var(--color-text-muted)' }}>
                  <code>{reason}</code>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid-kpi" style={{ marginTop: '20px' }}>
        <div className="kpi-card">
          <span className="kpi-title">Versión del Modelo</span>
          <span className="kpi-value" style={{ fontSize: '1.2rem' }}>
            {metrics.model_version || 'v2.0.0'}
          </span>
        </div>
        <div className="kpi-card">
          <span className="kpi-title">ROC-AUC (Test Set)</span>
          <span className="kpi-value">{metrics.roc_auc !== undefined ? metrics.roc_auc : '--'}</span>
          {metrics.roc_auc_ci_95 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              CI 95%: [{metrics.roc_auc_ci_95[0]}, {metrics.roc_auc_ci_95[1]}]
            </span>
          )}
        </div>
        <div className="kpi-card">
          <span className="kpi-title">PR-AUC (Test Set)</span>
          <span className="kpi-value">{metrics.pr_auc !== undefined ? metrics.pr_auc : '--'}</span>
          {metrics.pr_auc_lift_over_prevalence && (
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Lift: {metrics.pr_auc_lift_over_prevalence}x sobre prevalencia
            </span>
          )}
        </div>
        <div className="kpi-card">
          <span className="kpi-title">Muestras de Test</span>
          <span className="kpi-value">{metrics.test_samples ? metrics.test_samples.toLocaleString() : '--'}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Atrasos reales: {metrics.test_positive_count || 0}
          </span>
        </div>
      </div>

      <div className="glass-card" style={{ marginTop: '24px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>Comparación Frente a Baselines</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
              <th style={{ padding: '8px' }}>Modelo</th>
              <th style={{ padding: '8px' }}>ROC-AUC</th>
              <th style={{ padding: '8px' }}>PR-AUC</th>
              <th style={{ padding: '8px' }}>Precision</th>
              <th style={{ padding: '8px' }}>Recall</th>
              <th style={{ padding: '8px' }}>F1 Score</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '8px', fontWeight: 600 }}>XGBoost Tuned (v2.0.0)</td>
              <td style={{ padding: '8px' }}>{metrics.roc_auc}</td>
              <td style={{ padding: '8px' }}>{metrics.pr_auc}</td>
              <td style={{ padding: '8px' }}>{metrics.precision}</td>
              <td style={{ padding: '8px' }}>{metrics.recall}</td>
              <td style={{ padding: '8px' }}>{metrics.f1}</td>
            </tr>
            {metrics.baselines?.logistic_regression && (
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={{ padding: '8px' }}>Logistic Regression Baseline</td>
                <td style={{ padding: '8px' }}>{metrics.baselines.logistic_regression.roc_auc}</td>
                <td style={{ padding: '8px' }}>{metrics.baselines.logistic_regression.pr_auc}</td>
                <td style={{ padding: '8px' }}>{metrics.baselines.logistic_regression.precision}</td>
                <td style={{ padding: '8px' }}>{metrics.baselines.logistic_regression.recall}</td>
                <td style={{ padding: '8px' }}>{metrics.baselines.logistic_regression.f1}</td>
              </tr>
            )}
            {metrics.baselines?.dummy_classifier && (
              <tr>
                <td style={{ padding: '8px' }}>Dummy Prior Baseline</td>
                <td style={{ padding: '8px' }}>{metrics.baselines.dummy_classifier.roc_auc}</td>
                <td style={{ padding: '8px' }}>{metrics.baselines.dummy_classifier.pr_auc}</td>
                <td style={{ padding: '8px' }}>{metrics.baselines.dummy_classifier.precision}</td>
                <td style={{ padding: '8px' }}>{metrics.baselines.dummy_classifier.recall}</td>
                <td style={{ padding: '8px' }}>{metrics.baselines.dummy_classifier.f1}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
