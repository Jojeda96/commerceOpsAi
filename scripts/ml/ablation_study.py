import os
import sys

root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

import pandas as pd
import numpy as np
from xgboost import XGBClassifier
from sklearn.metrics import average_precision_score, roc_auc_score

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from scripts.ml.features import add_direct_features
from scripts.ml.temporal_history import add_all_temporal_features
from scripts.ml.split import temporal_train_validation_test_split
from scripts.ml.baselines import build_preprocessor, NUMERIC_FEATURES, CATEGORICAL_FEATURES


def run_ablation_study():
    parquet_path = os.path.join(root_dir, "data", "processed", "delivery_model_dataset.parquet")

    if not os.path.exists(parquet_path):
        print(f"[Ablation] Error: No existe {parquet_path}")
        return

    print("[Ablation] Cargando dataset y calculando features...")
    df = pd.read_parquet(parquet_path)
    df = add_direct_features(df)
    df = add_all_temporal_features(df)

    train, val, test = temporal_train_validation_test_split(df, 0.70, 0.15)

    feature_sets = {
        "A_base": (
            ["total_price", "total_freight", "freight_ratio", "item_count", "purchase_dow", "purchase_hour"],
            ["primary_seller_state", "customer_state", "is_interstate"],
        ),
        "B_base_plus_estimate": (
            ["total_price", "total_freight", "freight_ratio", "estimated_delivery_days", "shipping_window_days", "item_count", "purchase_dow", "purchase_hour"],
            ["primary_seller_state", "customer_state", "is_interstate"],
        ),
        "C_plus_distance": (
            ["total_price", "total_freight", "freight_ratio", "estimated_delivery_days", "shipping_window_days", "route_distance_km", "item_count", "purchase_dow", "purchase_hour"],
            ["primary_seller_state", "customer_state", "is_interstate", "route_pair"],
        ),
        "D_full": (
            NUMERIC_FEATURES,
            CATEGORICAL_FEATURES,
        ),
    }

    results = {}
    print("[Ablation] Evaluando conjuntos de características en Validation...")

    for name, (num_cols, cat_cols) in feature_sets.items():
        existing_num = [c for c in num_cols if c in train.columns]
        existing_cat = [c for c in cat_cols if c in train.columns]

        preprocessor = build_preprocessor(existing_num, existing_cat)
        X_train_t = preprocessor.fit_transform(train[existing_num + existing_cat])
        X_val_t = preprocessor.transform(val[existing_num + existing_cat])

        y_train = train["is_delayed"].to_numpy()
        y_val = val["is_delayed"].to_numpy()

        scale = float((y_train == 0).sum() / max((y_train == 1).sum(), 1))

        xgb = XGBClassifier(
            n_estimators=300,
            learning_rate=0.03,
            max_depth=5,
            scale_pos_weight=scale,
            random_state=42,
            n_jobs=-1,
            eval_metric="aucpr",
        )
        xgb.fit(X_train_t, y_train, eval_set=[(X_val_t, y_val)], verbose=False)

        preds_val = xgb.predict_proba(X_val_t)[:, 1]

        val_roc = roc_auc_score(y_val, preds_val)
        val_pr = average_precision_score(y_val, preds_val)
        prev = y_val.mean()

        results[name] = {
            "num_features": len(existing_num) + len(existing_cat),
            "val_roc_auc": round(float(val_roc), 4),
            "val_pr_auc": round(float(val_pr), 4),
            "pr_auc_lift": round(float(val_pr / prev), 4) if prev > 0 else 1.0,
        }

        print(f"  [Set {name}] Features: {len(existing_num) + len(existing_cat)} | ROC-AUC: {val_roc:.4f} | PR-AUC: {val_pr:.4f} (Lift: {val_pr/prev:.2f}x)")

    return results


if __name__ == "__main__":
    run_ablation_study()
