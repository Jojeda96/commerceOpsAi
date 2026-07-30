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
        "logistic_regression",
        "xgboost",
    }
    assert status["load_error"] is None


def test_bundle_contract():
    bundle_path = os.path.join(
        MLEngine.get_instance().models_dir,
        "delivery_delay_xgb.joblib"
    )
    bundle = joblib.load(bundle_path)
    validate_bundle(bundle)
