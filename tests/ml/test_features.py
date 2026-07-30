import pytest
import pandas as pd
import numpy as np
from scripts.ml.features import haversine_km, add_direct_features


def test_haversine_km_known_distance():
    # Sao Paulo lat/lng approx (-23.55, -46.63) to Rio de Janeiro approx (-22.90, -43.17)
    # Distancia en línea recta ~360 km
    sp_lat, sp_lng = -23.5505, -46.6333
    rj_lat, rj_lng = -22.9068, -43.1729

    dist = haversine_km(sp_lat, sp_lng, rj_lat, rj_lng)
    assert 340.0 <= dist <= 380.0


def test_add_direct_features_computations():
    df = pd.DataFrame([
        {
            "purchase_date": "2020-01-01 10:00:00",
            "estimated_date": "2020-01-10 00:00:00",
            "last_shipping_limit": "2020-01-05 00:00:00",
            "primary_seller_state": "SP",
            "customer_state": "RJ",
            "total_price": 100.0,
            "total_freight": 25.0,
            "item_count": 2,
            "total_weight_g": 1000.0,
            "total_volume_cm3": 8000.0,
            "primary_seller_lat": -23.55,
            "primary_seller_lng": -46.63,
            "customer_lat": -22.90,
            "customer_lng": -43.17,
        }
    ])

    out = add_direct_features(df)

    assert out.iloc[0]["is_interstate"] == 1
    assert out.iloc[0]["route_pair"] == "SP->RJ"
    assert out.iloc[0]["freight_ratio"] == pytest.approx(25.0 / 125.0, 1e-4)
    assert out.iloc[0]["estimated_delivery_days"] == pytest.approx(8.5833, 1e-2)
    assert out.iloc[0]["avg_item_price"] == 50.0
    assert out.iloc[0]["avg_item_weight_g"] == 500.0
    assert out.iloc[0]["route_distance_km"] > 300.0
    assert out.iloc[0]["route_distance_missing"] == 0
