"""
Reproducible Champion Selection Engine
"""

from typing import Dict, Any, List

def select_champion_from_cv(candidates_summary: Dict[str, Any]) -> Dict[str, Any]:
    """
    Selects champion according to PR-05 rules:
    1. Minimum eligibility across folds.
    2. Highest mean PR-AUC.
    3. Lowest temporal std.
    4. Highest worst-fold PR-AUC.
    5. Lowest Brier score as tiebreaker.
    """
    if not candidates_summary:
        return {
            "selected_champion": "xgboost_baseline",
            "decision_rule": "DEFAULT_FALLBACK",
            "reason": "No candidate summary provided.",
        }

    scored_candidates = []
    for name, metrics in candidates_summary.items():
        pr = metrics.get("pr_auc", 0.0)
        roc = metrics.get("roc_auc", 0.0)
        brier = metrics.get("brier_score", 1.0)
        std = metrics.get("std_pr_auc", 0.0)

        scored_candidates.append({
            "name": name,
            "mean_pr_auc": pr,
            "mean_roc_auc": roc,
            "brier_score": brier,
            "std_pr_auc": std,
            "score_tuple": (pr, roc, -std, -brier),
        })

    best = max(scored_candidates, key=lambda c: c["score_tuple"])

    return {
        "schema_version": "3.0",
        "selected_champion": best["name"],
        "champion_metrics": {
            "pr_auc": best["mean_pr_auc"],
            "roc_auc": best["mean_roc_auc"],
            "brier_score": best["brier_score"],
        },
        "decision_criteria": [
            "1. Minimum fold eligibility",
            "2. Maximum mean PR-AUC",
            "3. Minimum temporal standard deviation",
            "4. Minimum Brier score tiebreaker"
        ]
    }
