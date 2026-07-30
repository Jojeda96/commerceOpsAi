from dataclasses import dataclass
from typing import Any, Dict, List
import json
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
GATES_CONFIG_PATH = PROJECT_ROOT / "data" / "contracts" / "delivery_quality_gates.v3.json"


@dataclass(frozen=True)
class ModelGateResult:
    approved: bool
    status: str
    reasons: List[str]


def evaluate_delivery_model(metrics: Dict[str, Any]) -> ModelGateResult:
    reasons: List[str] = []

    if not metrics or metrics.get("status") == "MODEL_NOT_TRAINED":
        return ModelGateResult(
            approved=False,
            status="UNAVAILABLE",
            reasons=["MODEL_NOT_TRAINED"],
        )

    test_samples = int(metrics.get("test_samples", 0))
    test_positives = int(metrics.get("test_positive_count", metrics.get("test_positives", 0)))
    roc_auc = float(metrics.get("roc_auc", 0.0))
    pr_auc = float(metrics.get("pr_auc", 0.0))
    prevalence = float(metrics.get("test_positive_ratio", metrics.get("positive_class_ratio", 0.0)))
    recall = float(metrics.get("recall", 0.0))
    precision = float(metrics.get("precision", 0.0))

    # 1. Absolute Gates
    if test_samples < 5_000:
        reasons.append("TEST_SAMPLE_TOO_SMALL")

    if test_positives < 200:
        reasons.append("INSUFFICIENT_POSITIVE_TEST_CASES")

    if roc_auc < 0.60:
        reasons.append("ROC_AUC_BELOW_0_60")

    if prevalence <= 0 or pr_auc < prevalence * 1.50:
        reasons.append("PR_AUC_INSUFFICIENT_LIFT_OVER_PREVALENCE")

    if recall < 0.50:
        reasons.append("RECALL_BELOW_0_50")

    if precision < 0.15:
        reasons.append("PRECISION_BELOW_0_15")

    # 2. Relative Gate: Champion CV vs Best Logistic CV
    cand_summary = metrics.get("candidates_val_summary") or metrics.get("candidates", {})
    best_log_key = metrics.get("best_logistic_candidate")

    logistic_candidates = {}
    if isinstance(cand_summary, dict):
        for k, v in cand_summary.items():
            if k.startswith("logistic") or (isinstance(v, dict) and v.get("family") == "LOGISTIC_REGRESSION"):
                logistic_candidates[k] = v

    if logistic_candidates:
        if best_log_key and best_log_key in logistic_candidates:
            best_log_metrics = logistic_candidates[best_log_key]
        else:
            best_log_metrics = max(
                logistic_candidates.values(),
                key=lambda m: m.get("pr_auc", 0.0) if isinstance(m, dict) else 0.0,
            )

        if isinstance(best_log_metrics, dict):
            best_log_pr = float(best_log_metrics.get("pr_auc", 0.0))
            best_log_roc = float(best_log_metrics.get("roc_auc", 0.0))

            # Champion validation metrics
            champion_name = metrics.get("champion_model_name", metrics.get("model_name", ""))
            champion_val = cand_summary.get(champion_name, {})
            if isinstance(champion_val, dict):
                champ_val_pr = float(champion_val.get("pr_auc", pr_auc))
                champ_val_roc = float(champion_val.get("roc_auc", roc_auc))

                if champ_val_pr < best_log_pr:
                    reasons.append("DOES_NOT_BEAT_BEST_LOGISTIC_PR_AUC")
                if champ_val_roc < best_log_roc:
                    reasons.append("DOES_NOT_BEAT_BEST_LOGISTIC_ROC_AUC")

    if reasons:
        return ModelGateResult(
            approved=False,
            status="EXPERIMENTAL_NOT_APPROVED",
            reasons=reasons,
        )

    return ModelGateResult(
        approved=True,
        status="APPROVED_FOR_DEMO_INFERENCE",
        reasons=[],
    )
