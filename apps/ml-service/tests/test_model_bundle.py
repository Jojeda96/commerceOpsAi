import os
import joblib
import pytest
from app.services.model_bundle import validate_bundle
from app.services.ml_engine import MLEngine


def test_versioned_bundle_is_loadable():
    engine = MLEngine.get_instance()
    status = engine.get_runtime_status()

    assert status["runtime_ready"] is True
    assert status["model_version"] is not None
    assert status["model_name"] in {
        "logistic_unweighted",
        "logistic_balanced",
        "logistic_cw_1_3",
        "xgboost_baseline",
        "xgboost_tuned",
        "xgboost",
    }
    assert status["load_error"] is None


def test_bundle_contract():
    champion_path = os.path.join(
        MLEngine.get_instance().models_dir,
        "delivery_delay_champion.joblib"
    )
    if os.path.exists(champion_path):
        bundle = joblib.load(champion_path)
        validate_bundle(bundle)
