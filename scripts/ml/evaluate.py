import numpy as np
from typing import Dict, Any, Tuple, Callable
from sklearn.metrics import (
    average_precision_score,
    balanced_accuracy_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    log_loss,
    precision_score,
    recall_score,
    roc_auc_score,
)


def evaluate_binary_classifier(
    y_true: np.ndarray,
    probabilities: np.ndarray,
    threshold: float = 0.5,
) -> Dict[str, Any]:
    y_true = np.asarray(y_true, dtype=int)
    probabilities = np.asarray(probabilities, dtype=float)
    predictions = (probabilities >= threshold).astype(int)

    tn, fp, fn, tp = confusion_matrix(
        y_true,
        predictions,
        labels=[0, 1],
    ).ravel()

    prevalence = float(np.mean(y_true))
    pr_auc = float(average_precision_score(y_true, probabilities))
    roc_auc = float(roc_auc_score(y_true, probabilities)) if len(np.unique(y_true)) > 1 else 0.5

    return {
        "sample_count": int(len(y_true)),
        "positive_count": int(np.sum(y_true)),
        "positive_ratio": prevalence,
        "threshold": float(threshold),
        "roc_auc": round(roc_auc, 4),
        "pr_auc": round(pr_auc, 4),
        "pr_auc_lift_over_prevalence": (
            round(pr_auc / prevalence, 4) if prevalence > 0 else None
        ),
        "precision": round(float(precision_score(y_true, predictions, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, predictions, zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, predictions, zero_division=0)), 4),
        "balanced_accuracy": round(float(balanced_accuracy_score(y_true, predictions)), 4),
        "brier_score": round(float(brier_score_loss(y_true, probabilities)), 4),
        "log_loss": round(float(log_loss(y_true, probabilities)), 4),
        "confusion_matrix": {
            "tn": int(tn),
            "fp": int(fp),
            "fn": int(fn),
            "tp": int(tp),
        },
    }


def ranking_metrics(
    y_true: np.ndarray, probabilities: np.ndarray, fraction: float
) -> Dict[str, Any]:
    y_true = np.asarray(y_true, dtype=int)
    probabilities = np.asarray(probabilities, dtype=float)
    cutoff = max(1, int(len(y_true) * fraction))
    top_indices = np.argsort(probabilities)[::-1][:cutoff]

    selected_y = y_true[top_indices]
    captured = int(selected_y.sum())
    total_positives = int(y_true.sum())

    precision_at_k = captured / cutoff
    recall_at_k = captured / total_positives if total_positives > 0 else 0.0
    prevalence = float(y_true.mean())

    return {
        "fraction": fraction,
        "selected_count": cutoff,
        "precision_at_k": round(precision_at_k, 4),
        "recall_at_k": round(recall_at_k, 4),
        "lift_at_k": (
            round(precision_at_k / prevalence, 4) if prevalence > 0 else None
        ),
    }


def bootstrap_metric_ci(
    y_true: np.ndarray,
    probabilities: np.ndarray,
    metric_fn: Callable[[np.ndarray, np.ndarray], float],
    iterations: int = 1_000,
    seed: int = 42,
) -> Tuple[float, float]:
    rng = np.random.default_rng(seed)
    values = []
    y_true = np.asarray(y_true)
    probabilities = np.asarray(probabilities)

    for _ in range(iterations):
        indices = rng.integers(0, len(y_true), len(y_true))
        sampled_y = y_true[indices]

        if len(np.unique(sampled_y)) < 2:
            continue

        values.append(metric_fn(sampled_y, probabilities[indices]))

    if not values:
        return 0.0, 0.0

    return (
        round(float(np.percentile(values, 2.5)), 4),
        round(float(np.percentile(values, 97.5)), 4),
    )
