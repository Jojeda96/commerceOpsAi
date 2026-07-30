"""
Error Analysis (FP / FN Diagnostic Breakdown)
"""

from typing import Dict, Any, List
import pandas as pd
import numpy as np

def run_error_analysis(df: pd.DataFrame, y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, Any]:
    df = df.copy()
    df["y_true"] = y_true
    df["y_pred"] = y_pred
    df["is_fp"] = (df["y_pred"] == 1) & (df["y_true"] == 0)
    df["is_fn"] = (df["y_pred"] == 0) & (df["y_true"] == 1)

    fp_count = int(df["is_fp"].sum())
    fn_count = int(df["is_fn"].sum())

    # Segment breakdowns
    by_category = {}
    if "primary_category" in df.columns:
        for cat, grp in df.groupby("primary_category"):
            by_category[str(cat)] = {
                "total": len(grp),
                "fp": int(grp["is_fp"].sum()),
                "fn": int(grp["is_fn"].sum()),
            }

    by_seller_state = {}
    if "primary_seller_state" in df.columns:
        for st, grp in df.groupby("primary_seller_state"):
            by_seller_state[str(st)] = {
                "total": len(grp),
                "fp": int(grp["is_fp"].sum()),
                "fn": int(grp["is_fn"].sum()),
            }

    return {
        "schema_version": "3.0",
        "total_false_positives": fp_count,
        "total_false_negatives": fn_count,
        "fp_rate": round(fp_count / len(df), 4) if len(df) > 0 else 0.0,
        "fn_rate": round(fn_count / len(df), 4) if len(df) > 0 else 0.0,
        "breakdown_by_category": by_category,
        "breakdown_by_seller_state": by_seller_state,
        "causal_conclusion": "ROOT_CAUSE_NOT_PROVEN",
    }
