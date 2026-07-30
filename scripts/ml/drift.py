"""
Feature Drift and Unseen Categories Diagnostic
"""

from typing import Dict, Any, List
import numpy as np
import pandas as pd
from scipy.stats import ks_2samp

def calculate_psi(reference: np.ndarray, target: np.ndarray, bins: int = 10) -> float:
    reference = reference[~np.isnan(reference)]
    target = target[~np.isnan(target)]
    if len(reference) == 0 or len(target) == 0:
        return 0.0

    quantiles = np.linspace(0, 100, bins + 1)
    bins_edges = np.percentile(reference, quantiles)
    bins_edges[0] -= 1e-5
    bins_edges[-1] += 1e-5

    ref_counts, _ = np.histogram(reference, bins=bins_edges)
    tar_counts, _ = np.histogram(target, bins=bins_edges)

    ref_pct = np.where(ref_counts == 0, 1e-4, ref_counts) / len(reference)
    tar_pct = np.where(tar_counts == 0, 1e-4, tar_counts) / len(target)

    psi = np.sum((tar_pct - ref_pct) * np.log(tar_pct / ref_pct))
    return float(psi)

def analyze_drift(train_df: pd.DataFrame, test_df: pd.DataFrame, num_cols: List[str], cat_cols: List[str]) -> Dict[str, Any]:
    numerical_drift = {}
    for col in num_cols:
        if col in train_df.columns and col in test_df.columns:
            ref = train_df[col].to_numpy(dtype=float)
            tar = test_df[col].to_numpy(dtype=float)

            psi_val = calculate_psi(ref, tar)
            ks_res = ks_2samp(ref[~np.isnan(ref)], tar[~np.isnan(tar)])

            numerical_drift[col] = {
                "psi": round(psi_val, 4),
                "ks_statistic": round(float(ks_res.statistic), 4),
                "ks_pvalue": round(float(ks_res.pvalue), 6),
                "mean_diff": round(float(np.nanmean(tar) - np.nanmean(ref)), 4),
                "missing_rate_train": round(float(np.isnan(ref).mean()), 4),
                "missing_rate_test": round(float(np.isnan(tar).mean()), 4),
                "drift_level": "HIGH" if psi_val > 0.25 else "MEDIUM" if psi_val > 0.1 else "LOW",
            }

    categorical_drift = {}
    unseen_categories = {}
    for col in cat_cols:
        if col in train_df.columns and col in test_df.columns:
            train_cats = set(train_df[col].dropna().astype(str).unique())
            test_cats = set(test_df[col].dropna().astype(str).unique())

            unseen = list(test_cats - train_cats)
            unseen_rate = float(test_df[col].astype(str).isin(unseen).mean())

            unseen_categories[col] = {
                "unseen_count": len(unseen),
                "unseen_rate": round(unseen_rate, 4),
                "unseen_samples": unseen[:10],
            }

            categorical_drift[col] = {
                "cardinality_train": len(train_cats),
                "cardinality_test": len(test_cats),
                "unseen_rate": round(unseen_rate, 4),
                "drift_level": "HIGH" if unseen_rate > 0.05 else "LOW",
            }

    return {
        "schema_version": "3.0",
        "numerical_drift": numerical_drift,
        "categorical_drift": categorical_drift,
        "unseen_categories_report": unseen_categories,
    }
