// PR-11: Strict TypeScript interfaces for ML Governance page.
// No `any` allowed in governance components.

export interface FinalTestMetrics {
  roc_auc: number;
  pr_auc: number;
  pr_auc_lift_over_prevalence: number;
  precision: number;
  recall: number;
  f1: number;
  brier_score: number;
}

export interface SelectionMetrics {
  roc_auc: number;
  pr_auc: number;
  brier_score: number;
}

export interface ChampionInfo {
  model_name: string;
  selection_dataset: string;
  selection_metrics: SelectionMetrics;
  final_test_metrics: FinalTestMetrics;
}

export interface CandidateMetrics {
  roc_auc: number;
  pr_auc: number;
  brier_score: number;
  is_champion?: boolean;
}

export interface QualityGate {
  status: string;
  reasons: string[];
  thresholds_version: string;
}

export interface ConfusionMatrix {
  tn: number;
  fp: number;
  fn: number;
  tp: number;
}

export interface MlMetricsV3 {
  metrics_schema_version: string;
  champion: ChampionInfo;
  candidates: Record<string, CandidateMetrics>;
  best_logistic_candidate: string;
  quality_gate: QualityGate;
  sample_count: number;
  positive_count: number;
  positive_ratio: number;
  threshold: number;
  roc_auc: number;
  pr_auc: number;
  pr_auc_lift_over_prevalence: number;
  precision: number;
  recall: number;
  f1: number;
  balanced_accuracy: number;
  brier_score: number;
  log_loss: number;
  confusion_matrix: ConfusionMatrix;
  roc_auc_ci_95: [number, number];
  pr_auc_ci_95: [number, number];
  test_positive_count: number;
  test_samples: number;
  test_positive_ratio: number;
  champion_model_name: string;
  deployment_status: string;
  deployment_reasons: string[];
  model_version: string;
  trained_at: string;
  features: string[];
}

export interface MlRuntimeStatus {
  runtime_ready: boolean;
  deployment_status: string;
  model_name?: string;
  model_family?: string;
  bundle_path?: string;
  bundle_schema_version?: string;
  feature_contract_version?: string;
  trained_at?: string;
  load_error?: string;
}

export interface TemporalFold {
  fold: number;
  train_range: [string, string];
  val_range: [string, string];
  train_samples: number;
  val_samples: number;
  positives: number;
  prevalence: number;
  roc_auc: number;
  pr_auc: number;
  brier_score: number;
}

export interface WalkForwardSummary {
  mean_pr_auc: number;
  std_pr_auc: number;
  min_pr_auc: number;
  max_pr_auc: number;
  mean_roc_auc: number;
  worst_fold: number;
}

export interface WalkForwardValidation {
  schema_version: string;
  n_folds: number;
  folds: TemporalFold[];
  summary: WalkForwardSummary;
  generated_at: string;
  feature_contract_version: string;
}

export interface DriftFeature {
  psi: number;
  ks_statistic: number;
  ks_pvalue: number;
  mean_diff: number;
  missing_rate_train: number;
  missing_rate_test: number;
  drift_level: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface CategoricalDriftFeature {
  cardinality_train: number;
  cardinality_test: number;
  unseen_rate: number;
  drift_level: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface DriftReport {
  schema_version: string;
  generated_at: string;
  feature_contract_version: string;
  drift: Record<string, DriftFeature>;
  categorical_drift: Record<string, CategoricalDriftFeature>;
}

export interface DefenseQuestion {
  id: string;
  question: string;
  answer: string;
  dynamicFacts?: Array<{ key: string; format: string }>;
  evidence?: string[];
  is_dynamic?: boolean;
}

export interface DefenseCategory {
  id: string;
  title: string;
  questions: DefenseQuestion[];
}

export interface MetricsSnapshot {
  champion_model_name: string | undefined;
  deployment_status: string | undefined;
  roc_auc_test: number | undefined;
  pr_auc_test: number | undefined;
  brier_score_test: number | undefined;
  gate_status: string | undefined;
  gate_reasons: string[] | undefined;
  trained_at: string | undefined;
  model_version: string | undefined;
  positive_ratio: number | undefined;
}

export interface MlDefenseResponse {
  schema_version: string;
  categories: DefenseCategory[];
  metrics_snapshot: MetricsSnapshot;
}
