import os
import sys

root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ml_service_dir = os.path.join(root_dir, "apps", "ml-service")
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
if ml_service_dir not in sys.path:
    sys.path.insert(0, ml_service_dir)

import json
import joblib
import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from xgboost import XGBClassifier

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from scripts.ml.features import add_direct_features
from scripts.ml.temporal_history import add_all_temporal_features
from scripts.ml.split import temporal_train_validation_test_split
from scripts.ml.baselines import (
    build_preprocessor,
    build_logistic_baseline,
)
from scripts.ml.evaluate import (
    evaluate_binary_classifier,
    ranking_metrics,
    bootstrap_metric_ci,
)
from app.services.calibration import PlattCalibrator
from scripts.ml.calibrate_and_threshold import select_threshold_for_min_precision
from app.services.model_governance import evaluate_delivery_model

NUMERIC_FEATURES = [
    "total_price",
    "total_freight",
    "freight_ratio",
    "estimated_delivery_days",
    "shipping_window_days",
    "avg_item_price",
    "avg_item_weight_g",
    "avg_item_volume_cm3",
    "route_distance_km",
    "purchase_dow",
    "purchase_hour",
    "purchase_month",
    "purchase_week",
    "item_count",
    "seller_count",
    "seller_prior_orders",
    "seller_prior_late_rate_smoothed",
    "route_prior_orders",
    "route_prior_late_rate_smoothed",
    "category_prior_orders",
    "category_prior_late_rate_smoothed",
]

CATEGORICAL_FEATURES = [
    "primary_seller_state",
    "customer_state",
    "route_pair",
    "primary_category",
    "is_interstate",
]


@dataclass
class ModelCandidate:
    name: str
    family: str
    model: Any
    preprocessor: Any
    validation_metrics: Dict[str, Any]
    calibrator: Any
    threshold: float
    raw_val_probs: np.ndarray
    calibrated_val_probs: np.ndarray


def train_pipeline():
    dataset_path = os.path.join(root_dir, "data", "processed", "delivery_model_dataset.parquet")
    manifest_path = os.path.join(root_dir, "data", "processed", "delivery_model_manifest.json")
    models_dir = os.path.join(root_dir, "data", "models")
    os.makedirs(models_dir, exist_ok=True)

    if not os.path.exists(dataset_path):
        print(f"[Train] Error: No existe {dataset_path}. Ejecute build_delivery_dataset.py primero.")
        return

    print("[Train] Cargando dataset de pedidos Olist...")
    df = pd.read_parquet(dataset_path)

    manifest = {}
    if os.path.exists(manifest_path):
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)

    print("[Train] Generando ingeniería de características...")
    df = add_direct_features(df)
    df = add_all_temporal_features(df)

    num_cols = [c for c in NUMERIC_FEATURES if c in df.columns]
    cat_cols = [c for c in CATEGORICAL_FEATURES if c in df.columns]
    all_feature_cols = num_cols + cat_cols

    print(f"[Train] Total de variables activas: {len(all_feature_cols)} (Num: {len(num_cols)}, Cat: {len(cat_cols)})")

    train, val, test = temporal_train_validation_test_split(df, 0.70, 0.15)
    print(f"[Train] Split cronológico: Train={len(train)}, Validation={len(val)}, Test={len(test)}")

    y_train = train["is_delayed"].to_numpy()
    y_val = val["is_delayed"].to_numpy()
    y_test = test["is_delayed"].to_numpy()

    preprocessor = build_preprocessor(num_cols, cat_cols)
    X_train_t = preprocessor.fit_transform(train[all_feature_cols])
    X_val_t = preprocessor.transform(val[all_feature_cols])
    X_test_t = preprocessor.transform(test[all_feature_cols])

    try:
        feature_names = preprocessor.get_feature_names_out().tolist()
    except Exception:
        feature_names = [f"f_{i}" for i in range(X_train_t.shape[1])]

    candidates: List[ModelCandidate] = []

    # Candidate 1: Logistic Regression Unweighted
    print("[Train] Evaluando candidato: logistic_unweighted...")
    lr_unweighted_pipe = build_logistic_baseline(num_cols, cat_cols, class_weight=None)
    lr_unweighted_pipe.fit(train[all_feature_cols], y_train)
    lr_unw_raw = lr_unweighted_pipe.predict_proba(val[all_feature_cols])[:, 1]
    cal_lr_unw = PlattCalibrator().fit(lr_unw_raw, y_val)
    cal_lr_unw_probs = cal_lr_unw.predict(lr_unw_raw)
    thresh_lr_unw = select_threshold_for_min_precision(y_val, cal_lr_unw_probs, 0.15)
    eval_lr_unw = evaluate_binary_classifier(y_val, cal_lr_unw_probs, thresh_lr_unw)
    candidates.append(ModelCandidate("logistic_unweighted", "LOGISTIC_REGRESSION", lr_unweighted_pipe.named_steps["model"], preprocessor, eval_lr_unw, cal_lr_unw, thresh_lr_unw, lr_unw_raw, cal_lr_unw_probs))

    # Candidate 2: Logistic Regression Balanced
    print("[Train] Evaluando candidato: logistic_balanced...")
    lr_balanced_pipe = build_logistic_baseline(num_cols, cat_cols, class_weight="balanced")
    lr_balanced_pipe.fit(train[all_feature_cols], y_train)
    lr_bal_raw = lr_balanced_pipe.predict_proba(val[all_feature_cols])[:, 1]
    cal_lr_bal = PlattCalibrator().fit(lr_bal_raw, y_val)
    cal_lr_bal_probs = cal_lr_bal.predict(lr_bal_raw)
    thresh_lr_bal = select_threshold_for_min_precision(y_val, cal_lr_bal_probs, 0.15)
    eval_lr_bal = evaluate_binary_classifier(y_val, cal_lr_bal_probs, thresh_lr_bal)
    candidates.append(ModelCandidate("logistic_balanced", "LOGISTIC_REGRESSION", lr_balanced_pipe.named_steps["model"], preprocessor, eval_lr_bal, cal_lr_bal, thresh_lr_bal, lr_bal_raw, cal_lr_bal_probs))

    # Candidate 3: Logistic Regression Class Weight 1:3
    print("[Train] Evaluando candidato: logistic_cw_1_3...")
    lr_cw3_pipe = build_logistic_baseline(num_cols, cat_cols, class_weight={0: 1, 1: 3})
    lr_cw3_pipe.fit(train[all_feature_cols], y_train)
    lr_cw3_raw = lr_cw3_pipe.predict_proba(val[all_feature_cols])[:, 1]
    cal_lr_cw3 = PlattCalibrator().fit(lr_cw3_raw, y_val)
    cal_lr_cw3_probs = cal_lr_cw3.predict(lr_cw3_raw)
    thresh_lr_cw3 = select_threshold_for_min_precision(y_val, cal_lr_cw3_probs, 0.15)
    eval_lr_cw3 = evaluate_binary_classifier(y_val, cal_lr_cw3_probs, thresh_lr_cw3)
    candidates.append(ModelCandidate("logistic_cw_1_3", "LOGISTIC_REGRESSION", lr_cw3_pipe.named_steps["model"], preprocessor, eval_lr_cw3, cal_lr_cw3, thresh_lr_cw3, lr_cw3_raw, cal_lr_cw3_probs))

    # Candidate 4: XGBoost Baseline
    print("[Train] Evaluando candidato: xgboost_baseline...")
    pos_count = int(y_train.sum())
    neg_count = len(y_train) - pos_count
    scale_pos_weight = float(neg_count / max(pos_count, 1))

    xgb_model = XGBClassifier(
        objective="binary:logistic",
        eval_metric="aucpr",
        tree_method="hist",
        n_estimators=1_000,
        learning_rate=0.03,
        max_depth=5,
        min_child_weight=5,
        subsample=0.85,
        colsample_bytree=0.85,
        scale_pos_weight=scale_pos_weight,
        random_state=42,
        n_jobs=-1,
    )
    xgb_model.fit(X_train_t, y_train, eval_set=[(X_val_t, y_val)], verbose=False)
    xgb_raw = xgb_model.predict_proba(X_val_t)[:, 1]
    cal_xgb = PlattCalibrator().fit(xgb_raw, y_val)
    cal_xgb_probs = cal_xgb.predict(xgb_raw)
    thresh_xgb = select_threshold_for_min_precision(y_val, cal_xgb_probs, 0.15)
    eval_xgb = evaluate_binary_classifier(y_val, cal_xgb_probs, thresh_xgb)
    candidates.append(ModelCandidate("xgboost_baseline", "TREE_BOOSTING", xgb_model, preprocessor, eval_xgb, cal_xgb, thresh_xgb, xgb_raw, cal_xgb_probs))

    # Champion Selection strictly on Validation Set
    print("\n[Train] --- RESUMEN DE CANDIDATOS EN VALIDACIÓN ---")
    for c in candidates:
        print(f"  [{c.name}] ROC-AUC: {c.validation_metrics['roc_auc']:.4f} | PR-AUC: {c.validation_metrics['pr_auc']:.4f} | Brier: {c.validation_metrics['brier_score']:.4f}")

    eligible = [
        candidate for candidate in candidates
        if candidate.validation_metrics["roc_auc"] >= 0.55
        and candidate.validation_metrics["pr_auc_lift_over_prevalence"] >= 1.25
    ]

    if eligible:
        champion = max(
            eligible,
            key=lambda c: (
                c.validation_metrics["pr_auc"],
                c.validation_metrics["roc_auc"],
                -c.validation_metrics["brier_score"],
            ),
        )
    else:
        print("[Train] ⚠️ Ningún candidato superó el umbral estricto de elegibilidad. Seleccionando el de mejor PR-AUC en validación.")
        champion = max(
            candidates,
            key=lambda c: (
                c.validation_metrics["pr_auc"],
                c.validation_metrics["roc_auc"],
            ),
        )

    print(f"\n🏆 CHAMPION SELECCIONADO: {champion.name} ({champion.family})")

    # EVALUACIÓN ÚNICA DEL CHAMPION EN TEST SET
    print("[Train] Evaluando modelo CHAMPION en TEST SET inalterado...")
    if champion.family == "LOGISTIC_REGRESSION":
        raw_test_probs = champion.model.predict_proba(champion.preprocessor.transform(test[all_feature_cols]))[:, 1]
    else:
        raw_test_probs = champion.model.predict_proba(X_test_t)[:, 1]

    test_probs = champion.calibrator.predict(raw_test_probs)

    test_metrics = evaluate_binary_classifier(y_test, test_probs, threshold=champion.threshold)
    test_ranking_5 = ranking_metrics(y_test, test_probs, fraction=0.05)
    test_ranking_10 = ranking_metrics(y_test, test_probs, fraction=0.10)

    from sklearn.metrics import roc_auc_score, average_precision_score
    roc_ci_low, roc_ci_high = bootstrap_metric_ci(y_test, test_probs, lambda y, p: float(roc_auc_score(y, p)))
    pr_ci_low, pr_ci_high = bootstrap_metric_ci(y_test, test_probs, lambda y, p: float(average_precision_score(y, p)))

    test_metrics["roc_auc_ci_95"] = [roc_ci_low, roc_ci_high]
    test_metrics["pr_auc_ci_95"] = [pr_ci_low, pr_ci_high]
    test_metrics["ranking_top_5_percent"] = test_ranking_5
    test_metrics["ranking_top_10_percent"] = test_ranking_10
    test_metrics["test_positive_count"] = int(y_test.sum())
    test_metrics["test_samples"] = len(y_test)
    test_metrics["test_positive_ratio"] = round(float(y_test.mean()), 4)
    test_metrics["champion_model_name"] = champion.name

    test_metrics["candidates_val_summary"] = {
        c.name: {
            "roc_auc": c.validation_metrics["roc_auc"],
            "pr_auc": c.validation_metrics["pr_auc"],
            "brier_score": c.validation_metrics["brier_score"],
        }
        for c in candidates
    }

    # Quality Gate Check
    print("[Train] Evaluando Quality Gates del Modelo Champion...")
    gate = evaluate_delivery_model(test_metrics)
    print(f"[Train] Estado del Quality Gate: {gate.status} (Aprobado: {gate.approved})")
    if gate.reasons:
        print(f"  Razones del gate: {gate.reasons}")

    test_metrics["deployment_status"] = gate.status
    test_metrics["deployment_reasons"] = gate.reasons
    test_metrics["model_version"] = "delivery-risk-v3.0.0"
    test_metrics["trained_at"] = datetime.now(timezone.utc).isoformat()
    test_metrics["features"] = all_feature_cols

    import sklearn

    bundle = {
        "bundle_schema_version": "3.0",
        "feature_contract_version": "delivery-features-v3.0.0",
        "model": champion.model,
        "model_name": champion.name,
        "model_family": champion.family,
        "preprocessor": champion.preprocessor,
        "calibrator": champion.calibrator,
        "threshold": champion.threshold,
        "metrics": test_metrics,
        "deployment_status": gate.status,
        "model_version": "delivery-risk-v3.0.0",
        "raw_features": all_feature_cols,
        "feature_names": feature_names,
        "categorical_features": cat_cols,
        "numeric_features": num_cols,
        "manifest": manifest,
        "library_versions": {
            "sklearn": sklearn.__version__,
            "joblib": joblib.__version__,
            "numpy": np.__version__,
        },
    }

    champion_gen_path = os.path.join(models_dir, "delivery_delay_champion.joblib")
    metrics_path = os.path.join(models_dir, "delivery_delay_metrics.json")

    joblib.dump(bundle, champion_gen_path)
    print(f"[Train] [OK] Bundle del modelo champion V3.0 guardado en: {champion_gen_path}")

    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(test_metrics, f, indent=2)
    print(f"[Train] [OK] Métricas guardadas en: {metrics_path}")

    return test_metrics


if __name__ == "__main__":
    train_pipeline()
