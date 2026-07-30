import pytest
import numpy as np
from unittest.mock import MagicMock
from app.services.model_adapters.factory import get_model_adapter
from app.services.model_adapters.linear import LinearModelAdapter
from app.services.model_adapters.tree import TreeModelAdapter

def test_xgboost_adapter_explains():
    mock_model = MagicMock()
    mock_model.__class__.__name__ = "XGBClassifier"
    mock_model.predict_proba.return_value = np.array([[0.8, 0.2]])
    
    adapter = get_model_adapter(mock_model, model_family="TREE_BOOSTING")
    assert isinstance(adapter, TreeModelAdapter)
    
    X = np.array([[1.0, 2.0]])
    explanation = adapter.explain(X, feature_names=["f1", "f2"])
    assert explanation["explanation_method"] == "SHAP_TREE"
    assert explanation["explanation_scale"] == "RAW_MARGIN"

def test_logistic_adapter_explains_without_tree_shap():
    mock_model = MagicMock()
    mock_model.__class__.__name__ = "LogisticRegression"
    mock_model.intercept_ = np.array([-1.5])
    mock_model.coef_ = np.array([[0.5, -0.3]])
    mock_model.predict_proba.return_value = np.array([[0.7, 0.3]])

    adapter = get_model_adapter(mock_model, model_family="LOGISTIC_REGRESSION")
    assert isinstance(adapter, LinearModelAdapter)

    X = np.array([[2.0, 4.0]])
    explanation = adapter.explain(X, feature_names=["f1", "f2"])
    assert explanation["explanation_method"] == "LINEAR_LOG_ODDS_CONTRIBUTION"
    assert explanation["explanation_scale"] == "LOG_ODDS"
    assert len(explanation["contributions"]) == 2
    assert explanation["contributions"][0]["feature"] in ["f1", "f2"]

def test_all_candidate_names_are_supported():
    candidate_families = {
        "logistic_unweighted": "LOGISTIC_REGRESSION",
        "logistic_balanced": "LOGISTIC_REGRESSION",
        "logistic_cw_1_3": "LOGISTIC_REGRESSION",
        "xgboost_baseline": "TREE_BOOSTING",
        "xgboost_tuned": "TREE_BOOSTING",
    }
    for name, family in candidate_families.items():
        mock_model = MagicMock()
        adapter = get_model_adapter(mock_model, model_family=family)
        assert adapter is not None
