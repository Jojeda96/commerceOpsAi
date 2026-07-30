import pytest
import numpy as np
from scripts.ml.evaluate import evaluate_binary_classifier, ranking_metrics, bootstrap_metric_ci


def test_evaluate_binary_classifier_computations():
    y_true = np.array([0, 0, 0, 0, 1, 1, 1, 1, 0, 0]) # 410, prevalencia = 0.4
    probabilities = np.array([0.1, 0.2, 0.3, 0.4, 0.7, 0.8, 0.9, 0.6, 0.2, 0.1])

    res = evaluate_binary_classifier(y_true, probabilities, threshold=0.5)

    assert res["sample_count"] == 10
    assert res["positive_count"] == 4
    assert res["positive_ratio"] == 0.4
    assert res["roc_auc"] == 1.0
    assert res["pr_auc"] == 1.0
    assert res["pr_auc_lift_over_prevalence"] == 2.5
    assert res["precision"] == 1.0
    assert res["recall"] == 1.0


def test_ranking_metrics():
    y_true = np.array([0, 0, 0, 0, 0, 0, 0, 0, 1, 1])
    probabilities = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95])

    rank = ranking_metrics(y_true, probabilities, fraction=0.20)
    assert rank["selected_count"] == 2
    assert rank["precision_at_k"] == 1.0
    assert rank["recall_at_k"] == 1.0
    assert rank["lift_at_k"] == 5.0


def test_bootstrap_metric_ci():
    y_true = np.array([0]*90 + [1]*10)
    probabilities = np.linspace(0.0, 1.0, 100)

    ci_low, ci_high = bootstrap_metric_ci(
        y_true, probabilities, lambda y, p: float(np.mean(y)), iterations=100
    )
    assert 0.03 <= ci_low <= 0.17
    assert 0.03 <= ci_high <= 0.17
