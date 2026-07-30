import json
import pytest
from pathlib import Path
import pandas as pd
from scripts.ml.features import add_direct_features
from scripts.ml.available_history import add_available_outcome_history

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = PROJECT_ROOT / "data" / "contracts" / "delivery_feature_contract.v3.json"

def test_snapshot_features_match_training_features():
    with open(CONTRACT_PATH, "r", encoding="utf-8") as f:
        contract = json.load(f)
    contract_features = [feat["name"] for feat in contract["features"]]
    
    # Verify derived and core features are present in contract features
    for req in ["total_price", "total_freight", "freight_ratio", "shipping_window_days", "seller_prior_late_rate_smoothed", "route_prior_late_rate_smoothed", "category_prior_late_rate_smoothed"]:
        assert req in contract_features

def test_unfinished_order_not_in_history():
    # An order that is not delivered or delivered after current purchase_date must NOT be in available history
    df = pd.DataFrame([
        {
            "internal_order_id": "ord_1",
            "primary_seller_id": "seller_A",
            "purchase_date": "2017-01-01T10:00:00",
            "delivered_date": "2017-01-05T10:00:00",
            "is_delayed": 1
        },
        {
            "internal_order_id": "ord_2",
            "primary_seller_id": "seller_A",
            "purchase_date": "2017-01-03T10:00:00",
            "delivered_date": "2017-01-08T10:00:00",
            "is_delayed": 0
        }
    ])
    
    res = add_available_outcome_history(df, group_col="primary_seller_id", prefix="seller")
    # For ord_2 purchased at 2017-01-03, ord_1 delivered at 2017-01-05 has NOT been delivered yet.
    # Therefore, seller_prior_orders for ord_2 MUST be 0!
    ord_2_prior_orders = res.loc[res["internal_order_id"] == "ord_2", "seller_prior_orders"].values[0]
    assert ord_2_prior_orders == 0

def test_shipping_window_uses_shipping_limit():
    df = pd.DataFrame([{
        "purchase_date": "2017-01-01T00:00:00",
        "estimated_date": "2017-01-15T00:00:00",
        "last_shipping_limit": "2017-01-06T00:00:00",
        "primary_seller_state": "SP",
        "customer_state": "RJ",
        "total_price": 100.0,
        "total_freight": 20.0,
        "item_count": 1,
        "total_weight_g": 500.0,
        "total_volume_cm3": 1000.0,
    }])
    
    res = add_direct_features(df)
    assert res["shipping_window_days"].iloc[0] == pytest.approx(5.0)  # 2017-01-06 - 2017-01-01 = 5 days

def test_seller_route_category_histories_are_distinct():
    df = pd.DataFrame([
        {
            "internal_order_id": "o1",
            "primary_seller_id": "s1",
            "route_pair": "SP->RJ",
            "primary_category": "cat1",
            "purchase_date": "2017-01-01T00:00:00",
            "delivered_date": "2017-01-02T00:00:00",
            "is_delayed": 1
        },
        {
            "internal_order_id": "o2",
            "primary_seller_id": "s1",
            "route_pair": "SP->MG",
            "primary_category": "cat2",
            "purchase_date": "2017-01-03T00:00:00",
            "delivered_date": "2017-01-04T00:00:00",
            "is_delayed": 0
        }
    ])
    
    res_seller = add_available_outcome_history(df, group_col="primary_seller_id", prefix="seller")
    res_route = add_available_outcome_history(df, group_col="route_pair", prefix="route")
    
    # For order o2, seller s1 has prior order (o1), so seller_prior_orders == 1
    # But for route_pair SP->MG, there are NO prior orders, so route_prior_orders == 0
    assert res_seller.loc[res_seller["internal_order_id"] == "o2", "seller_prior_orders"].values[0] == 1
    assert res_route.loc[res_route["internal_order_id"] == "o2", "route_prior_orders"].values[0] == 0
