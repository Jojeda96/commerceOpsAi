/**
 * PR-11 — Frontend tests for ML Governance page
 * Tests enforce: no localhost:8000, no hardcoded "XGBoost Tuned", strict types,
 * visible folds, drift warning, defense filter, copy, unavailable state.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ---------- Mocks ----------

const MOCK_METRICS = {
  metrics_schema_version: '3.0',
  champion: {
    model_name: 'xgboost_baseline',
    selection_dataset: 'TEMPORAL_CV_DEVELOPMENT',
    selection_metrics: { roc_auc: 0.7371, pr_auc: 0.1593, brier_score: 0.0479 },
    final_test_metrics: {
      roc_auc: 0.4528,
      pr_auc: 0.0698,
      pr_auc_lift_over_prevalence: 1.0553,
      precision: 0.0635,
      recall: 0.2309,
      f1: 0.0997,
      brier_score: 0.0652,
    },
  },
  candidates: {
    logistic_unweighted: { roc_auc: 0.7264, pr_auc: 0.1441, brier_score: 0.0483 },
    xgboost_baseline: { roc_auc: 0.7371, pr_auc: 0.1593, brier_score: 0.0479 },
  },
  best_logistic_candidate: 'logistic_unweighted',
  quality_gate: {
    status: 'EXPERIMENTAL_NOT_APPROVED',
    reasons: ['ROC_AUC_BELOW_0_60'],
    thresholds_version: 'delivery-gates-v3',
  },
  sample_count: 14471,
  positive_count: 957,
  positive_ratio: 0.0661,
  threshold: 0.09,
  roc_auc: 0.4528,
  pr_auc: 0.0698,
  pr_auc_lift_over_prevalence: 1.0553,
  precision: 0.0635,
  recall: 0.2309,
  f1: 0.0997,
  balanced_accuracy: 0.495,
  brier_score: 0.0652,
  log_loss: 0.2784,
  confusion_matrix: { tn: 10257, fp: 3257, fn: 736, tp: 221 },
  roc_auc_ci_95: [0.4327, 0.4734] as [number, number],
  pr_auc_ci_95: [0.0621, 0.0789] as [number, number],
  test_positive_count: 957,
  test_samples: 14471,
  test_positive_ratio: 0.0661,
  champion_model_name: 'xgboost_baseline',
  candidates_val_summary: {},
  deployment_status: 'EXPERIMENTAL_NOT_APPROVED',
  deployment_reasons: ['ROC_AUC_BELOW_0_60'],
  model_version: 'delivery-risk-v3.0.0',
  trained_at: '2026-07-30T18:12:35.025295+00:00',
  features: ['total_price', 'total_freight'],
};

const MOCK_RUNTIME = {
  runtime_ready: true,
  deployment_status: 'EXPERIMENTAL_NOT_APPROVED',
  model_name: 'xgboost_baseline',
  model_family: 'TREE_BOOSTING',
  bundle_schema_version: '3.0',
  feature_contract_version: 'delivery-features-v3.0.0',
};

const MOCK_VALIDATION = {
  schema_version: '3.0',
  n_folds: 2,
  folds: [
    {
      fold: 1,
      train_range: ['2016-09-15', '2017-07-18'] as [string, string],
      val_range: ['2017-09-17', '2017-11-13'] as [string, string],
      train_samples: 16399,
      val_samples: 8199,
      positives: 424,
      prevalence: 0.0517,
      roc_auc: 0.71,
      pr_auc: 0.155,
      brier_score: 0.049,
    },
    {
      fold: 2,
      train_range: ['2016-09-15', '2017-11-13'] as [string, string],
      val_range: ['2017-12-12', '2018-01-24'] as [string, string],
      train_samples: 32798,
      val_samples: 8199,
      positives: 478,
      prevalence: 0.0583,
      roc_auc: 0.72,
      pr_auc: 0.16,
      brier_score: 0.048,
    },
  ],
  summary: {
    mean_pr_auc: 0.1575,
    std_pr_auc: 0.0025,
    min_pr_auc: 0.155,
    max_pr_auc: 0.16,
    mean_roc_auc: 0.715,
    worst_fold: 1,
  },
  generated_at: '2026-07-30T19:43:30.146425+00:00',
  feature_contract_version: 'delivery-features-v3.0.0',
};

const MOCK_DRIFT = {
  schema_version: '3.0',
  generated_at: '2026-07-30T19:43:30.146425+00:00',
  feature_contract_version: 'delivery-features-v3.0.0',
  drift: {
    total_freight: {
      psi: 0.3069,
      ks_statistic: 0.1814,
      ks_pvalue: 0.0,
      mean_diff: 2.4129,
      missing_rate_train: 0.0,
      missing_rate_test: 0.0,
      drift_level: 'HIGH' as const,
    },
    total_price: {
      psi: 0.0087,
      ks_statistic: 0.0124,
      ks_pvalue: 0.049,
      mean_diff: -0.63,
      missing_rate_train: 0.0,
      missing_rate_test: 0.0,
      drift_level: 'LOW' as const,
    },
  },
  categorical_drift: {
    primary_category: {
      cardinality_train: 72,
      cardinality_test: 68,
      unseen_rate: 0.0008,
      drift_level: 'LOW' as const,
    },
  },
};

const MOCK_DEFENSE = {
  schema_version: '1.0',
  categories: [
    {
      id: 'temporal-validation',
      title: 'Validación temporal',
      questions: [
        {
          id: 'why-not-random-split',
          question: '¿Por qué no usaste un split aleatorio?',
          answer:
            'Un split aleatorio mezcla temporalmente el futuro con el pasado durante el entrenamiento, creando leakage implícito que infla las métricas artificialmente.',
          evidence: ['data/models/reports/walk_forward_metrics.json'],
          is_dynamic: false,
        },
        {
          id: 'what-is-roc-auc',
          question: '¿Cuál es el ROC-AUC del champion en test?',
          answer: 'El ROC-AUC del champion en test es {roc_auc_test}.',
          is_dynamic: true,
          evidence: ['data/models/delivery_delay_metrics.json'],
        },
      ],
    },
  ],
  metrics_snapshot: {
    champion_model_name: 'xgboost_baseline',
    deployment_status: 'EXPERIMENTAL_NOT_APPROVED',
    roc_auc_test: 0.4528,
    pr_auc_test: 0.0698,
    brier_score_test: 0.0652,
    gate_status: 'EXPERIMENTAL_NOT_APPROVED',
    gate_reasons: ['ROC_AUC_BELOW_0_60'],
    trained_at: '2026-07-30T18:12:35Z',
    model_version: 'delivery-risk-v3.0.0',
    positive_ratio: 0.0661,
  },
};

// Mock fetchApi to avoid network calls
jest.mock('@/lib/api-client', () => ({
  fetchApi: jest.fn(),
}));

import { fetchApi } from '@/lib/api-client';

const mockedFetch = fetchApi as jest.MockedFunction<typeof fetchApi>;

function setupSuccessfulMocks() {
  mockedFetch.mockImplementation((endpoint: string) => {
    const map: Record<string, unknown> = {
      '/analytics/ml-metrics': MOCK_METRICS,
      '/analytics/ml-runtime': MOCK_RUNTIME,
      '/analytics/ml-validation': MOCK_VALIDATION,
      '/analytics/ml-drift': MOCK_DRIFT,
      '/analytics/ml-defense': MOCK_DEFENSE,
    };
    const result = map[endpoint];
    if (result != null) return Promise.resolve(result as never);
    return Promise.reject(new Error(`Unmocked endpoint: ${endpoint}`));
  });
}

// ---------- Tests ----------

describe('ML Governance Page — PR-11', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders_generic_champion_name: displays model_name from API not hardcoded string', async () => {
    setupSuccessfulMocks();
    const { default: MLGovernancePage } = await import('./page');
    render(<MLGovernancePage />);
    await waitFor(() =>
      expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument(),
    );
    expect(screen.getByText('xgboost_baseline')).toBeInTheDocument();
  });

  it('does_not_contain_hardcoded_xgboost_tuned: no static "XGBoost Tuned" in DOM', async () => {
    setupSuccessfulMocks();
    const { default: MLGovernancePage } = await import('./page');
    const { container } = render(<MLGovernancePage />);
    await waitFor(() =>
      expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument(),
    );
    expect(container.innerHTML).not.toContain('XGBoost Tuned');
  });

  it('does_not_call_localhost_ml_service: no fetch to localhost:8000', async () => {
    setupSuccessfulMocks();
    const globalFetch = jest.spyOn(globalThis, 'fetch');
    const { default: MLGovernancePage } = await import('./page');
    render(<MLGovernancePage />);
    await waitFor(() =>
      expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument(),
    );
    const localCalls = globalFetch.mock.calls.filter((args) =>
      String(args[0]).includes('localhost:8000'),
    );
    expect(localCalls).toHaveLength(0);
    globalFetch.mockRestore();
  });

  it('renders_validation_folds: walk-forward CV folds table is visible', async () => {
    setupSuccessfulMocks();
    const { default: MLGovernancePage } = await import('./page');
    render(<MLGovernancePage />);
    await waitFor(() =>
      expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument(),
    );

    const temporalTab = screen.getByRole('tab', { name: /validación temporal/i });
    fireEvent.click(temporalTab);

    expect(screen.getByText(/walk-forward cv/i)).toBeInTheDocument();
    expect(screen.getByText('0.155')).toBeInTheDocument();
  });

  it('renders_drift_warning: HIGH drift triggers warning banner', async () => {
    setupSuccessfulMocks();
    const { default: MLGovernancePage } = await import('./page');
    render(<MLGovernancePage />);
    await waitFor(() =>
      expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument(),
    );

    const driftTab = screen.getByRole('tab', { name: /drift/i });
    fireEvent.click(driftTab);

    expect(screen.getByText(/1 feature/i)).toBeInTheDocument();
  });

  it('filters_defense_questions: search narrows displayed questions', async () => {
    setupSuccessfulMocks();
    const { default: MLGovernancePage } = await import('./page');
    render(<MLGovernancePage />);
    await waitFor(() =>
      expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument(),
    );

    const defenseTab = screen.getByRole('tab', { name: /defensa ds/i });
    fireEvent.click(defenseTab);

    const searchInput = screen.getByRole('searchbox');
    fireEvent.change(searchInput, { target: { value: 'aleatorio' } });

    expect(screen.getByText(/¿Por qué no usaste un split aleatorio\?/)).toBeInTheDocument();
    expect(screen.queryByText(/¿Cuál es el ROC-AUC/)).not.toBeInTheDocument();
  });

  it('renders_unavailable_without_fake_metrics: error state shows UNAVAILABLE not fake numbers', async () => {
    mockedFetch.mockRejectedValue(new Error('Service unavailable'));

    const { default: MLGovernancePage } = await import('./page');
    render(<MLGovernancePage />);
    await waitFor(() =>
      expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument(),
    );

    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
    // No fake numbers like "0.9876" should appear
    expect(screen.queryByText('0.9876')).not.toBeInTheDocument();
  });
});
