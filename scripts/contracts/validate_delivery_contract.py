#!/usr/bin/env python3
"""
Validates the canonical delivery feature contract V3 against:
1. Internal uniqueness and schema consistency.
2. Model bundle raw_features.
3. Metrics file feature list.
4. Example prediction request.
5. Invariants (no post-purchase / leakage fields).
"""

import sys
import json
from pathlib import Path
import joblib

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT / "apps" / "ml-service"))

CONTRACT_PATH = PROJECT_ROOT / "data" / "contracts" / "delivery_feature_contract.v3.json"
BUNDLE_PATH = PROJECT_ROOT / "data" / "models" / "delivery_delay_champion.joblib"
METRICS_PATH = PROJECT_ROOT / "data" / "models" / "delivery_delay_metrics.json"
REQUEST_EXAMPLE_PATH = PROJECT_ROOT / "data" / "contracts" / "delivery_prediction_request.example.json"

POST_PURCHASE_FORBIDDEN_FIELDS = {
    "order_delivered_carrier_date",
    "order_delivered_customer_date",
    "delivered_carrier_date",
    "delivered_customer_date",
    "is_delayed",
}

def validate_contract():
    print(f"Reading contract from {CONTRACT_PATH}...")
    if not CONTRACT_PATH.exists():
        raise FileNotFoundError(f"Contract file not found: {CONTRACT_PATH}")
    
    with open(CONTRACT_PATH, "r", encoding="utf-8") as f:
        contract = json.load(f)

    # 1. Prediction moment & Contract Version
    if contract.get("prediction_moment") != "ORDER_PURCHASE":
        raise ValueError(f"Invalid prediction_moment: {contract.get('prediction_moment')}. Must be ORDER_PURCHASE.")

    features = contract.get("features", [])
    feature_names = [feat["name"] for feat in features]

    # 2. Unique feature names
    if len(feature_names) != len(set(feature_names)):
        duplicates = [name for name in feature_names if feature_names.count(name) > 1]
        raise ValueError(f"Duplicate feature names in contract: {set(duplicates)}")
    
    print(f"Contract V3 contains {len(feature_names)} unique features.")

    # 3. Check forbidden post-purchase fields in input features
    for name in feature_names:
        if name in POST_PURCHASE_FORBIDDEN_FIELDS:
            raise ValueError(f"Forbidden post-purchase field '{name}' found in feature contract.")

    # 4. Validate against bundle if present
    if BUNDLE_PATH.exists():
        print(f"Validating against model bundle {BUNDLE_PATH}...")
        bundle = joblib.load(BUNDLE_PATH)
        raw_features = bundle.get("raw_features")
        if raw_features is not None:
            if list(raw_features) != feature_names:
                diff_missing = set(feature_names) - set(raw_features)
                diff_extra = set(raw_features) - set(feature_names)
                raise ValueError(f"Mismatch between contract and bundle raw_features! Missing: {diff_missing}, Extra: {diff_extra}")
            print("Bundle raw_features match contract 100%.")

    # 5. Validate against metrics JSON if present
    if METRICS_PATH.exists():
        print(f"Validating against metrics file {METRICS_PATH}...")
        with open(METRICS_PATH, "r", encoding="utf-8") as f:
            metrics = json.load(f)
        metrics_features = metrics.get("features", [])
        if metrics_features != feature_names:
            diff_missing = set(feature_names) - set(metrics_features)
            diff_extra = set(metrics_features) - set(feature_names)
            raise ValueError(f"Mismatch between contract and metrics features! Missing: {diff_missing}, Extra: {diff_extra}")
        print("Metrics features match contract 100%.")

    # 6. Validate Example Prediction Request
    if REQUEST_EXAMPLE_PATH.exists():
        print(f"Validating example request {REQUEST_EXAMPLE_PATH}...")
        with open(REQUEST_EXAMPLE_PATH, "r", encoding="utf-8") as f:
            request_data = json.load(f)
        
        # Derived fields in builder: freight_ratio, avg_item_price, avg_item_weight_g, avg_item_volume_cm3, route_pair, is_interstate
        # Required input fields in request payload:
        required_request_inputs = {
            "scenario_id", "total_price", "total_freight", "estimated_delivery_days",
            "shipping_window_days", "total_weight_g", "total_volume_cm3",
            "purchase_dow", "purchase_hour", "purchase_month", "purchase_week",
            "item_count", "seller_count", "seller_prior_orders", "seller_prior_late_rate_smoothed",
            "route_prior_orders", "route_prior_late_rate_smoothed",
            "category_prior_orders", "category_prior_late_rate_smoothed",
            "primary_seller_state", "customer_state", "primary_category"
        }
        missing_keys = required_request_inputs - set(request_data.keys())
        if missing_keys:
            raise ValueError(f"Example request missing required fields: {missing_keys}")
        print("Example request contains all required input fields.")

    print("Contract validation SUCCESSFUL.")
    return 0

if __name__ == "__main__":
    try:
        sys.exit(validate_contract())
    except Exception as e:
        print(f"Contract Validation FAILED: {e}", file=sys.stderr)
        sys.exit(1)
