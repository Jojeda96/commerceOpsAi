import json
import pytest
from pathlib import Path
from app.models.delivery_contracts import PredictionRequest
from app.services.delivery_feature_builder import build_delivery_feature_row

PROJECT_ROOT = Path(__file__).resolve().parents[3]
CONTRACT_PATH = PROJECT_ROOT / "data" / "contracts" / "delivery_feature_contract.v3.json"

def test_training_serving_feature_parity():
    with open(CONTRACT_PATH, "r", encoding="utf-8") as f:
        contract = json.load(f)
    
    contract_features = [f["name"] for f in contract["features"]]

    sample_input = {
        "scenario_id": "PARITY_001",
        "total_price": 150.0,
        "total_freight": 30.0,
        "estimated_delivery_days": 12.0,
        "shipping_window_days": 6.0,
        "total_weight_g": 1200.0,
        "total_volume_cm3": 4000.0,
        "route_distance_km": 500.0,
        "purchase_dow": 3,
        "purchase_hour": 15,
        "purchase_month": 7,
        "purchase_week": 28,
        "item_count": 2,
        "seller_count": 1,
        "seller_prior_orders": 25,
        "seller_prior_late_rate_smoothed": 0.04,
        "route_prior_orders": 10,
        "route_prior_late_rate_smoothed": 0.07,
        "category_prior_orders": 100,
        "category_prior_late_rate_smoothed": 0.03,
        "primary_seller_state": "SP",
        "customer_state": "MG",
        "primary_category": "utilidades_domesticas"
    }

    req = PredictionRequest(**sample_input)
    df = build_delivery_feature_row(req, contract_features)

    assert list(df.columns) == contract_features
    assert df["freight_ratio"].iloc[0] == pytest.approx(30.0 / 150.0)
    assert df["avg_item_price"].iloc[0] == pytest.approx(75.0)
    assert df["avg_item_weight_g"].iloc[0] == pytest.approx(600.0)
    assert df["avg_item_volume_cm3"].iloc[0] == pytest.approx(2000.0)
    assert df["route_pair"].iloc[0] == "SP_MG"
    assert df["is_interstate"].iloc[0] == 1
