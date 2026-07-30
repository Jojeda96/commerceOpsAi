import pytest
import json
from pathlib import Path
from pydantic import ValidationError
from app.models.delivery_contracts import PredictionRequest, PredictionResponse
from app.services.delivery_feature_builder import build_delivery_feature_row, FeatureContractError

PROJECT_ROOT = Path(__file__).resolve().parents[3]
CONTRACT_PATH = PROJECT_ROOT / "data" / "contracts" / "delivery_feature_contract.v3.json"

@pytest.fixture
def valid_request_dict():
    return {
        "scenario_id": "SCENARIO_TEST_001",
        "total_price": 100.0,
        "total_freight": 20.0,
        "estimated_delivery_days": 10.0,
        "shipping_window_days": 4.0,
        "total_weight_g": 500.0,
        "total_volume_cm3": 1000.0,
        "route_distance_km": 300.0,
        "purchase_dow": 1,
        "purchase_hour": 10,
        "purchase_month": 3,
        "purchase_week": 11,
        "item_count": 1,
        "seller_count": 1,
        "seller_prior_orders": 10,
        "seller_prior_late_rate_smoothed": 0.05,
        "route_prior_orders": 5,
        "route_prior_late_rate_smoothed": 0.08,
        "category_prior_orders": 50,
        "category_prior_late_rate_smoothed": 0.04,
        "primary_seller_state": "SP",
        "customer_state": "RJ",
        "primary_category": "perfumaria"
    }

def test_request_rejects_unknown_fields(valid_request_dict):
    invalid = dict(valid_request_dict)
    invalid["unknown_extra_field"] = "unexpected_value"
    with pytest.raises(ValidationError):
        PredictionRequest(**invalid)

def test_request_rejects_missing_purchase_week(valid_request_dict):
    invalid = dict(valid_request_dict)
    del invalid["purchase_week"]
    with pytest.raises(ValidationError):
        PredictionRequest(**invalid)

def test_request_rejects_missing_route_history(valid_request_dict):
    invalid = dict(valid_request_dict)
    del invalid["route_prior_late_rate_smoothed"]
    with pytest.raises(ValidationError):
        PredictionRequest(**invalid)

def test_request_rejects_missing_category_history(valid_request_dict):
    invalid = dict(valid_request_dict)
    del invalid["category_prior_late_rate_smoothed"]
    with pytest.raises(ValidationError):
        PredictionRequest(**invalid)

def test_builder_output_equals_bundle_raw_features_in_order(valid_request_dict):
    with open(CONTRACT_PATH, "r", encoding="utf-8") as f:
        contract = json.load(f)
    raw_features = [f["name"] for f in contract["features"]]
    
    req = PredictionRequest(**valid_request_dict)
    df = build_delivery_feature_row(req, raw_features)
    assert list(df.columns) == raw_features
    assert df.shape == (1, len(raw_features))

def test_no_silent_defaults_exist():
    # Read ml_engine.py file content and verify absence of known silent fallback literals
    ml_engine_path = Path(__file__).resolve().parents[1] / "app" / "services" / "ml_engine.py"
    content = ml_engine_path.read_text(encoding="utf-8")
    
    forbidden_defaults = [
        "request_dict.get(\"seller_state\", \"SP\")",
        "request_dict.get(\"customer_state\", \"RJ\")",
        "request_dict.get(\"total_freight\", 30.0)",
        "seller_prior_late_rate_smoothed = 0.08",
        "route_prior_late_rate_smoothed = 0.08",
        "category_prior_late_rate_smoothed = 0.08",
    ]
    for pattern in forbidden_defaults:
        assert pattern not in content, f"Forbidden silent default pattern found in ml_engine.py: {pattern}"

def test_prediction_response_exposes_model_name():
    resp = PredictionResponse(
        scenario_id="S1",
        probability=0.1,
        predicted_delayed=False,
        threshold=0.5,
        risk_level="LOW",
        model_version="v3.0.0",
        model_name="xgboost_baseline",
        bundle_schema_version="3.0",
        feature_contract_version="delivery-features-v3.0.0",
        prediction_status="SUCCESS",
        deployment_status="EXPERIMENTAL_NOT_APPROVED",
        model_reliability="LOW",
        features={"f1": 1.0}
    )
    assert resp.model_name == "xgboost_baseline"
    assert resp.prediction_status == "SUCCESS"
