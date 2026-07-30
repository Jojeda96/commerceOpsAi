'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '@/lib/api-client';
import type {
  MlMetricsV3,
  MlRuntimeStatus,
  WalkForwardValidation,
  DriftReport,
  MlDefenseResponse,
} from './types';
import { GovernanceSummary } from './components/GovernanceSummary';
import { CandidateComparison } from './components/CandidateComparison';
import { TemporalValidation } from './components/TemporalValidation';
import { DriftPanel } from './components/DriftPanel';
import { ModelLimitations } from './components/ModelLimitations';
import { DataScientistDefense } from './components/DataScientistDefense';

// PR-11: Strictly typed page. No `any`. No direct ML service fallback.
// All data served through API Gateway (/api/analytics/*).

type TabId =
  | 'summary'
  | 'candidates'
  | 'temporal'
  | 'drift'
  | 'limitations'
  | 'defense';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'summary', label: '1. Estado y decisión' },
  { id: 'candidates', label: '2. Candidatos' },
  { id: 'temporal', label: '3. Validación temporal' },
  { id: 'drift', label: '4. Drift y errores' },
  { id: 'limitations', label: '5. Limitaciones' },
  { id: 'defense', label: '6. Defensa DS' },
];

interface PageData {
  metrics: MlMetricsV3;
  runtime: MlRuntimeStatus | null;
  validation: WalkForwardValidation;
  drift: DriftReport;
  defense: MlDefenseResponse;
}

interface LoadState {
  data: PageData | null;
  loading: boolean;
  error: string | null;
}

function LoadingSkeleton() {
  return (
    <div style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            style={{
              height: '36px',
              width: '130px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
            }}
          />
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: '80px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: '10px',
            marginBottom: '12px',
          }}
        />
      ))}
    </div>
  );
}

export default function MLGovernancePage() {
  const [state, setState] = useState<LoadState>({
    data: null,
    loading: true,
    error: null,
  });
  const [activeTab, setActiveTab] = useState<TabId>('summary');

  useEffect(() => {
    async function loadAll() {
      try {
        const [metrics, runtime, validation, drift, defense] = await Promise.allSettled([
          fetchApi<MlMetricsV3>('/analytics/ml-metrics'),
          fetchApi<MlRuntimeStatus>('/analytics/ml-runtime'),
          fetchApi<WalkForwardValidation>('/analytics/ml-validation'),
          fetchApi<DriftReport>('/analytics/ml-drift'),
          fetchApi<MlDefenseResponse>('/analytics/ml-defense'),
        ]);

        if (metrics.status === 'rejected') {
          setState({
            data: null,
            loading: false,
            error: 'No se pudo cargar las métricas del modelo ML. El servicio puede estar no disponible.',
          });
          return;
        }

        setState({
          data: {
            metrics: metrics.value,
            runtime: runtime.status === 'fulfilled' ? runtime.value : null,
            validation: validation.status === 'fulfilled' ? validation.value : null as unknown as WalkForwardValidation,
            drift: drift.status === 'fulfilled' ? drift.value : null as unknown as DriftReport,
            defense: defense.status === 'fulfilled'
              ? defense.value
              : { schema_version: '1.0', categories: [], metrics_snapshot: null as unknown as MlDefenseResponse['metrics_snapshot'] },
          },
          loading: false,
          error: null,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        setState({ data: null, loading: false, error: message });
      }
    }

    void loadAll();
  }, []);

  const { data, loading, error } = state;

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Gobernanza del Modelo ML</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Gobernanza, validación temporal, drift, limitaciones y defensa técnica del predictor
            de atrasos
          </p>
        </div>
      </div>

      {loading && <LoadingSkeleton />}

      {error && !loading && (
        <div
          className="glass-card"
          style={{
            borderLeft: '4px solid var(--color-accent-error, #ef4444)',
            padding: '20px',
          }}
        >
          <h2 style={{ color: 'var(--color-accent-error, #ef4444)', fontSize: '1rem', fontWeight: 600 }}>
            🔴 Servicio no disponible
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>
            {error}
          </p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '8px' }}>
            Estado: <code>UNAVAILABLE</code> — no se muestran métricas ficticias.
          </p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Tab navigation */}
          <div
            role="tablist"
            aria-label="Secciones de gobernanza ML"
            style={{
              display: 'flex',
              gap: '4px',
              flexWrap: 'wrap',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              marginBottom: '24px',
              paddingBottom: '0',
            }}
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`tabpanel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom:
                    activeTab === tab.id
                      ? '2px solid var(--color-accent-primary, #6366f1)'
                      : '2px solid transparent',
                  color:
                    activeTab === tab.id
                      ? 'var(--color-accent-primary, #6366f1)'
                      : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  padding: '8px 14px',
                  fontSize: '0.83rem',
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab panels */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <div
              id="tabpanel-summary"
              role="tabpanel"
              aria-labelledby="tab-summary"
              hidden={activeTab !== 'summary'}
            >
              <GovernanceSummary metrics={data.metrics} runtime={data.runtime} />
            </div>

            <div
              id="tabpanel-candidates"
              role="tabpanel"
              aria-labelledby="tab-candidates"
              hidden={activeTab !== 'candidates'}
            >
              <CandidateComparison metrics={data.metrics} />
            </div>

            <div
              id="tabpanel-temporal"
              role="tabpanel"
              aria-labelledby="tab-temporal"
              hidden={activeTab !== 'temporal'}
            >
              {data.validation ? (
                <TemporalValidation
                  validation={data.validation}
                  testRocAuc={data.metrics.champion.final_test_metrics.roc_auc}
                  testPrAuc={data.metrics.champion.final_test_metrics.pr_auc}
                />
              ) : (
                <p style={{ color: 'var(--color-text-muted)' }}>
                  Reporte de validación temporal no disponible.
                </p>
              )}
            </div>

            <div
              id="tabpanel-drift"
              role="tabpanel"
              aria-labelledby="tab-drift"
              hidden={activeTab !== 'drift'}
            >
              {data.drift ? (
                <DriftPanel drift={data.drift} />
              ) : (
                <p style={{ color: 'var(--color-text-muted)' }}>
                  Reporte de drift no disponible.
                </p>
              )}
            </div>

            <div
              id="tabpanel-limitations"
              role="tabpanel"
              aria-labelledby="tab-limitations"
              hidden={activeTab !== 'limitations'}
            >
              <ModelLimitations deploymentStatus={data.metrics.deployment_status} />
            </div>

            <div
              id="tabpanel-defense"
              role="tabpanel"
              aria-labelledby="tab-defense"
              hidden={activeTab !== 'defense'}
            >
              <DataScientistDefense defense={data.defense} />
            </div>
          </div>
        </>
      )}
    </>
  );
}
