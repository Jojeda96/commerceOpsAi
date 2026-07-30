"""
Monthly Metrics and Diagnostic Breakdown
"""

from typing import Dict, Any, List
import pandas as pd
import numpy as np
from sklearn.metrics import roc_auc_score, average_precision_score, brier_score_loss

def compute_monthly_metrics(df: pd.DataFrame, y_prob: np.ndarray = None) -> List[Dict[str, Any]]:
    df = df.copy()
    df["purchase_date"] = pd.to_datetime(df["purchase_date"])
    df["month_str"] = df["purchase_date"].dt.strftime("%Y-%m")

    if y_prob is None:
        y_prob = np.full(len(df), 0.08)

    df["y_prob"] = y_prob
    monthly_results = []

    for month_str, group in df.groupby("month_str"):
        y_true = group["is_delayed"].to_numpy()
        probs = group["y_prob"].to_numpy()
        n_samples = len(group)
        n_pos = int(y_true.sum())
        prevalence = float(n_pos / n_samples) if n_samples > 0 else 0.0

        if n_pos == 0 or n_pos == n_samples:
            monthly_results.append({
                "month": month_str,
                "samples": n_samples,
                "positives": n_pos,
                "prevalence": round(prevalence, 4),
                "metric_status": "NOT_COMPUTABLE",
                "roc_auc": None,
                "pr_auc": None,
                "brier": round(float(brier_score_loss(y_true, probs)), 4) if n_samples > 0 else None,
            })
        else:
            roc = float(roc_auc_score(y_true, probs))
            pr = float(average_precision_score(y_true, probs))
            brier = float(brier_score_loss(y_true, probs))
            monthly_results.append({
                "month": month_str,
                "samples": n_samples,
                "positives": n_pos,
                "prevalence": round(prevalence, 4),
                "metric_status": "COMPUTABLE",
                "roc_auc": round(roc, 4),
                "pr_auc": round(pr, 4),
                "brier": round(brier, 4),
            })

    return monthly_results
