import pytest
from app.services.model_governance import evaluate_delivery_model

def test_gate_reads_best_logistic_from_candidates():
    metrics = {
        "test_samples": 10000,
        "test_positive_count": 500,
        "test_positive_ratio": 0.05,
        "roc_auc": 0.75,
        "pr_auc": 0.25,
        "recall": 0.60,
        "precision": 0.20,
        "champion_model_name": "xgboost_baseline",
        "candidates_val_summary": {
            "logistic_unweighted": {"roc_auc": 0.70, "pr_auc": 0.20},
            "logistic_balanced": {"roc_auc": 0.72, "pr_auc": 0.22},
            "xgboost_baseline": {"roc_auc": 0.76, "pr_auc": 0.26},
        }
    }
    result = evaluate_delivery_model(metrics)
    assert result.approved is True
    assert "DOES_NOT_BEAT_BEST_LOGISTIC_PR_AUC" not in result.reasons

def test_gate_does_not_default_logistic_metrics_to_zero():
    # If champion validation PR-AUC is less than best logistic, gate must record failure reason
    metrics = {
        "test_samples": 10000,
        "test_positive_count": 500,
        "test_positive_ratio": 0.05,
        "roc_auc": 0.75,
        "pr_auc": 0.25,
        "recall": 0.60,
        "precision": 0.20,
        "champion_model_name": "xgboost_baseline",
        "candidates_val_summary": {
            "logistic_unweighted": {"roc_auc": 0.80, "pr_auc": 0.40},
            "xgboost_baseline": {"roc_auc": 0.70, "pr_auc": 0.20},
        }
    }
    result = evaluate_delivery_model(metrics)
    assert result.approved is False
    assert "DOES_NOT_BEAT_BEST_LOGISTIC_PR_AUC" in result.reasons

def test_gate_rejects_bad_absolute_test_metrics():
    metrics = {
        "test_samples": 1000, # Too small (<5000)
        "test_positive_count": 50, # Too small (<200)
        "roc_auc": 0.45, # Too low (<0.60)
        "pr_auc": 0.06,
        "test_positive_ratio": 0.06,
        "recall": 0.20, # Too low (<0.50)
        "precision": 0.05, # Too low (<0.15)
    }
    result = evaluate_delivery_model(metrics)
    assert result.approved is False
    assert "TEST_SAMPLE_TOO_SMALL" in result.reasons
    assert "INSUFFICIENT_POSITIVE_TEST_CASES" in result.reasons
    assert "ROC_AUC_BELOW_0_60" in result.reasons

def test_gate_approves_only_when_all_required_conditions_pass():
    valid_passing_metrics = {
        "test_samples": 10000,
        "test_positive_count": 600,
        "test_positive_ratio": 0.06,
        "roc_auc": 0.78,
        "pr_auc": 0.25,
        "recall": 0.65,
        "precision": 0.22,
        "champion_model_name": "xgboost_baseline",
        "candidates_val_summary": {
            "logistic_unweighted": {"roc_auc": 0.70, "pr_auc": 0.15},
            "xgboost_baseline": {"roc_auc": 0.80, "pr_auc": 0.28},
        }
    }
    result = evaluate_delivery_model(valid_passing_metrics)
    assert result.approved is True
    assert result.status == "APPROVED_FOR_DEMO_INFERENCE"
    assert len(result.reasons) == 0

def test_gate_reasons_are_deterministic():
    metrics = {
        "status": "MODEL_NOT_TRAINED"
    }
    result = evaluate_delivery_model(metrics)
    assert result.status == "UNAVAILABLE"
    assert result.reasons == ["MODEL_NOT_TRAINED"]
