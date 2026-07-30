import json
import pytest
from pathlib import Path
import joblib

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = PROJECT_ROOT / "data" / "contracts" / "delivery_feature_contract.v3.json"
BUNDLE_PATH = PROJECT_ROOT / "data" / "models" / "delivery_delay_champion.joblib"
METRICS_PATH = PROJECT_ROOT / "data" / "models" / "delivery_delay_metrics.json"
VALID_FIXTURE_PATH = PROJECT_ROOT / "data" / "fixtures" / "ml" / "delivery-feature-contract-valid.json"
INVALID_FIXTURE_PATH = PROJECT_ROOT / "data" / "fixtures" / "ml" / "delivery-feature-contract-missing-route-history.json"

POST_PURCHASE_FORBIDDEN_FIELDS = {
    "order_delivered_carrier_date",
    "order_delivered_customer_date",
    "delivered_carrier_date",
    "delivered_customer_date",
    "is_delayed",
}

@pytest.fixture
def contract_data():
    with open(CONTRACT_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def test_contract_feature_names_are_unique(contract_data):
    features = [f["name"] for f in contract_data["features"]]
    assert len(features) == len(set(features)), "Feature names must be unique"

def test_contract_matches_bundle_raw_features(contract_data):
    features = [f["name"] for f in contract_data["features"]]
    if BUNDLE_PATH.exists():
        bundle = joblib.load(BUNDLE_PATH)
        raw_features = list(bundle["raw_features"])
        assert features == raw_features, "Contract features must match bundle raw_features in exact order"

def test_contract_matches_metrics_features(contract_data):
    features = [f["name"] for f in contract_data["features"]]
    if METRICS_PATH.exists():
        with open(METRICS_PATH, "r", encoding="utf-8") as f:
            metrics = json.load(f)
        assert features == metrics["features"], "Contract features must match metrics file features in exact order"

def test_valid_example_contains_every_required_input():
    with open(VALID_FIXTURE_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    required_inputs = {
        "scenario_id", "total_price", "total_freight", "estimated_delivery_days",
        "shipping_window_days", "total_weight_g", "total_volume_cm3",
        "purchase_dow", "purchase_hour", "purchase_month", "purchase_week",
        "item_count", "seller_count", "seller_prior_orders", "seller_prior_late_rate_smoothed",
        "route_prior_orders", "route_prior_late_rate_smoothed",
        "category_prior_orders", "category_prior_late_rate_smoothed",
        "primary_seller_state", "customer_state", "primary_category"
    }
    assert required_inputs.issubset(set(data.keys())), "Valid fixture missing required inputs"

def test_invalid_example_is_rejected():
    with open(INVALID_FIXTURE_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    required_inputs = {
        "seller_prior_late_rate_smoothed",
        "route_prior_late_rate_smoothed",
        "category_prior_late_rate_smoothed"
    }
    assert not required_inputs.issubset(set(data.keys())), "Invalid fixture should be missing route history keys"

def test_no_post_purchase_fields_exist(contract_data):
    features = [f["name"] for f in contract_data["features"]]
    for feat in features:
        assert feat not in POST_PURCHASE_FORBIDDEN_FIELDS, f"Forbidden post-purchase field found: {feat}"
