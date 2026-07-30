from dataclasses import dataclass
from typing import Any, Dict, List


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

    logistic = metrics.get("baselines", {}).get("logistic_regression", {})
    logistic_roc = float(logistic.get("roc_auc", 0.0))
    logistic_pr = float(logistic.get("pr_auc", 0.0))

    # Quality Gates para aprobación del modelo
    if test_samples < 5_000:
        reasons.append("TEST_SAMPLE_TOO_SMALL")

    if test_positives < 200:
        reasons.append("INSUFFICIENT_POSITIVE_TEST_CASES")

    if roc_auc < 0.60:
        reasons.append("ROC_AUC_BELOW_0_60")

    if prevalence <= 0 or pr_auc < prevalence * 1.50:
        reasons.append("PR_AUC_INSUFFICIENT_LIFT_OVER_PREVALENCE")

    if roc_auc <= logistic_roc:
        reasons.append("DOES_NOT_BEAT_LOGISTIC_ROC_AUC")

    if pr_auc <= logistic_pr:
        reasons.append("DOES_NOT_BEAT_LOGISTIC_PR_AUC")

    if recall < 0.50:
        reasons.append("RECALL_BELOW_0_50")

    if precision < 0.15:
        reasons.append("PRECISION_BELOW_0_15")

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
