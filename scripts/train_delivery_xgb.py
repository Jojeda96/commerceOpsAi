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
    build_dummy_baseline,
)
from scripts.ml.evaluate import (
    evaluate_binary_classifier,
    ranking_metrics,
    bootstrap_metric_ci,
)
from scripts.ml.calibrate_and_threshold import PlattCalibrator, select_threshold_for_min_precision
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

    # Filtrar columnas disponibles
    num_cols = [c for c in NUMERIC_FEATURES if c in df.columns]
    cat_cols = [c for c in CATEGORICAL_FEATURES if c in df.columns]
    all_feature_cols = num_cols + cat_cols

    print(f"[Train] Total de variables activas: {len(all_feature_cols)} (Num: {len(num_cols)}, Cat: {len(cat_cols)})")

    # Split temporal estricto: Train (70%), Validation (15%), Test (15%)
    train, val, test = temporal_train_validation_test_split(df, 0.70, 0.15)
    print(f"[Train] Split cronológico: Train={len(train)}, Validation={len(val)}, Test={len(test)}")

    y_train = train["is_delayed"].to_numpy()
    y_val = val["is_delayed"].to_numpy()
    y_test = test["is_delayed"].to_numpy()

    # 1. Ajustar Preprocesador
    preprocessor = build_preprocessor(num_cols, cat_cols)
    X_train_t = preprocessor.fit_transform(train[all_feature_cols])
    X_val_t = preprocessor.transform(val[all_feature_cols])
    X_test_t = preprocessor.transform(test[all_feature_cols])

    # Extraer nombres de características transformadas
    try:
        feature_names = preprocessor.get_feature_names_out().tolist()
    except Exception:
        feature_names = [f"f_{i}" for i in range(X_train_t.shape[1])]

    # 2. Entrenar Baselines en Validation
    print("[Train] Entrenando Baselines (Dummy & Logistic Regression)...")
    dummy = build_dummy_baseline()
    dummy.fit(X_train_t, y_train)
    dummy_val_probs = dummy.predict_proba(X_val_t)[:, 1]
    dummy_val_eval = evaluate_binary_classifier(y_val, dummy_val_probs, 0.5)

    logistic_pipe = build_logistic_baseline(num_cols, cat_cols)
    logistic_pipe.fit(train[all_feature_cols], y_train)
    logistic_val_probs = logistic_pipe.predict_proba(val[all_feature_cols])[:, 1]
    logistic_val_eval = evaluate_binary_classifier(y_val, logistic_val_probs, 0.5)

    print(f"  [Baseline Dummy] Val ROC-AUC: {dummy_val_eval['roc_auc']:.4f} | PR-AUC: {dummy_val_eval['pr_auc']:.4f}")
    print(f"  [Baseline Logistic] Val ROC-AUC: {logistic_val_eval['roc_auc']:.4f} | PR-AUC: {logistic_val_eval['pr_auc']:.4f}")

    # 3. Entrenar XGBoost Classifier
    print("[Train] Entrenando XGBoost Classifier...")
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

    xgb_model.fit(
        X_train_t,
        y_train,
        eval_set=[(X_val_t, y_val)],
        verbose=False,
    )

    xgb_val_probs = xgb_model.predict_proba(X_val_t)[:, 1]
    xgb_val_eval = evaluate_binary_classifier(y_val, xgb_val_probs, 0.5)

    print(f"  [XGBoost] Val ROC-AUC: {xgb_val_eval['roc_auc']:.4f} | PR-AUC: {xgb_val_eval['pr_auc']:.4f} (Lift: {xgb_val_eval['pr_auc_lift_over_prevalence']:.2f}x)")

    # 4. Calibración en Validation (Platt Scaling)
    print("[Train] Calibrando probabilidades en Validation con Platt Scaling...")
    calibrator = PlattCalibrator()
    calibrator.fit(xgb_val_probs, y_val)
    calibrated_val_probs = calibrator.predict(xgb_val_probs)

    # 5. Selección del Threshold óptimo en Validation
    selected_threshold = select_threshold_for_min_precision(y_val, calibrated_val_probs, min_precision=0.15)
    print(f"[Train] Threshold operativo seleccionado en Validation: {selected_threshold:.4f}")

    # 6. EVALUACIÓN FINAL EN TEST SET (UNA SOLA VEZ)
    print("[Train] Evaluando modelo en TEST SET inalterado...")
    raw_test_probs = xgb_model.predict_proba(X_test_t)[:, 1]
    test_probs = calibrator.predict(raw_test_probs)

    test_metrics = evaluate_binary_classifier(y_test, test_probs, threshold=selected_threshold)
    test_ranking_5 = ranking_metrics(y_test, test_probs, fraction=0.05)
    test_ranking_10 = ranking_metrics(y_test, test_probs, fraction=0.10)

    # Calcular intervalos de confianza 95% Bootstrap para ROC-AUC y PR-AUC
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

    test_metrics["baselines"] = {
        "dummy_classifier": evaluate_binary_classifier(y_test, dummy.predict_proba(X_test_t)[:, 1], 0.5),
        "logistic_regression": evaluate_binary_classifier(y_test, logistic_pipe.predict_proba(test[all_feature_cols])[:, 1], 0.5),
    }

    # 7. Evaluación de Quality Gates
    print("[Train] Evaluando Quality Gates del Modelo...")
    gate = evaluate_delivery_model(test_metrics)
    print(f"[Train] Estado del Quality Gate: {gate.status} (Aprobado: {gate.approved})")
    if gate.reasons:
        print(f"  Razones del gate: {gate.reasons}")

    test_metrics["deployment_status"] = gate.status
    test_metrics["deployment_reasons"] = gate.reasons
    test_metrics["model_version"] = "delivery-risk-v2.0.0"
    test_metrics["trained_at"] = datetime.now(timezone.utc).isoformat()
    test_metrics["features"] = all_feature_cols

    # 8. Guardar Artefactos (Bundle unificado y Metrics JSON)
    bundle = {
        "model": xgb_model,
        "preprocessor": preprocessor,
        "calibrator": calibrator,
        "feature_names": feature_names,
        "raw_features": all_feature_cols,
        "categorical_features": cat_cols,
        "numeric_features": num_cols,
        "threshold": selected_threshold,
        "metrics": test_metrics,
        "manifest": manifest,
        "deployment_status": gate.status,
        "model_version": "delivery-risk-v2.0.0",
    }

    model_path = os.path.join(models_dir, "delivery_delay_xgb.joblib")
    metrics_path = os.path.join(models_dir, "delivery_delay_metrics.json")

    joblib.dump(bundle, model_path)
    print(f"[Train] [OK] Bundle del modelo guardado en: {model_path}")

    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(test_metrics, f, indent=2)
    print(f"[Train] [OK] Métricas guardadas en: {metrics_path}")

    # 9. Actualizar Model Card
    card_path = os.path.join(root_dir, "docs", "ml", "delivery-delay-model-card.md")
    status_icon = "🟢" if gate.approved else "🔴"
    card_content = f"""# Model Card — Delivery Delay Predictor (`delivery-risk-v2.0.0`)

## 📌 Resumen General
- **Modelo:** `XGBClassifier` (Hist Gradient Boosted Trees).
- **Tarea:** Clasificación binaria (`is_delayed = 1` si fecha real > fecha estimada de entrega).
- **Despliegue:** FastAPI Service (`apps/ml-service`).
- **Versión de Modelo:** `v2.0.0`.
- **Estado de Despliegue:** {status_icon} `{gate.status}`
- **Razones del Quality Gate:** {json.dumps(gate.reasons)}

---

## 📐 Dataset & Procesamiento (Olist Completo)
- **Muestras Totales:** {manifest.get('row_count', len(df))} pedidos.
- **División Temporal Estricta:** Train (70%: {len(train)}), Validation (15%: {len(val)}), Test (15%: {len(test)}).
- **Prevalencia en Test:** {test_metrics['positive_ratio']:.4%} ({test_metrics['test_positive_count']} atrasos reales).
- **Momento de Predicción:** `ORDER_PURCHASE` (sin leakage temporal de entrega o reseñas).

---

## 📊 Métricas Definitivas Evaluadas en Test Set

| Métrica | XGBoost Tuned (`v2.0.0`) | Baseline Logistic Regression | Baseline Dummy (Prior) |
|---|---|---|---|
| **Optimal Threshold** | `{selected_threshold:.4f}` | 0.50 | - |
| **ROC-AUC** | `{test_metrics['roc_auc']:.4f}` (CI 95%: {test_metrics['roc_auc_ci_95']}) | `{test_metrics['baselines']['logistic_regression']['roc_auc']:.4f}` | 0.5000 |
| **PR-AUC** | `{test_metrics['pr_auc']:.4f}` (CI 95%: {test_metrics['pr_auc_ci_95']}) | `{test_metrics['baselines']['logistic_regression']['pr_auc']:.4f}` | `{test_metrics['positive_ratio']:.4f}` |
| **PR-AUC Lift** | `{test_metrics['pr_auc_lift_over_prevalence']}x` | - | 1.0x |
| **Precision** | `{test_metrics['precision']:.4f}` | `{test_metrics['baselines']['logistic_regression']['precision']:.4f}` | 0.0000 |
| **Recall** | `{test_metrics['recall']:.4f}` | `{test_metrics['baselines']['logistic_regression']['recall']:.4f}` | 0.0000 |
| **F1 Score** | `{test_metrics['f1']:.4f}` | `{test_metrics['baselines']['logistic_regression']['f1']:.4f}` | 0.0000 |
| **Brier Score** | `{test_metrics['brier_score']:.4f}` | N/A | N/A |
| **Precision@5% Top** | `{test_ranking_5['precision_at_k']:.4f}` | N/A | - |
| **Recall@5% Top** | `{test_ranking_5['recall_at_k']:.4f}` | N/A | - |
| **Lift@5% Top** | `{test_ranking_5['lift_at_k']}x` | N/A | - |

---

## ⚠️ Gobernanza y Bloqueo Operativo

1. **Gate Automático:** Estado actual `{gate.status}`.
2. **Inferencia Operativa:** Servido a través del bundle versionado `.joblib`.
"""
    with open(card_path, "w", encoding="utf-8") as f:
        f.write(card_content)
    print(f"[Train] [OK] Model Card actualizado en: {card_path}")

    return test_metrics


if __name__ == "__main__":
    train_pipeline()
