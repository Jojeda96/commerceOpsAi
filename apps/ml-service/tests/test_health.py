from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

VALID_V3_PAYLOAD = {
    "scenario_id": "HEALTH_TEST_001",
    "primary_seller_state": "SP",
    "customer_state": "RJ",
    "total_freight": 45.0,
    "total_price": 100.0,
    "total_weight_g": 500.0,
    "total_volume_cm3": 4500.0,
    "estimated_delivery_days": 10.0,
    "shipping_window_days": 5.0,
    "route_distance_km": 400.0,
    "purchase_dow": 2,
    "purchase_hour": 14,
    "purchase_month": 6,
    "purchase_week": 24,
    "item_count": 2,
    "seller_count": 1,
    "seller_prior_orders": 10,
    "seller_prior_late_rate_smoothed": 0.08,
    "route_prior_orders": 5,
    "route_prior_late_rate_smoothed": 0.08,
    "category_prior_orders": 50,
    "category_prior_late_rate_smoothed": 0.08,
    "primary_category": "beleza_saude",
}

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["runtime_ready"] is True
    assert data["bundle_schema_version"] in ["2.1", "3.0"]
    assert "delivery-features-v3" in data["feature_contract_version"]
    assert "deployment_status" in data

def test_predict_endpoint_unapproved_model_rejected():
    response = client.post(
        "/models/delivery-delay/predict",
        json=VALID_V3_PAYLOAD,
    )
    assert response.status_code == 503
    data = response.json()["detail"]
    assert data["code"] == "MODEL_NOT_APPROVED"

def test_predict_endpoint_experimental_allowed():
    response = client.post(
        "/models/delivery-delay/predict?allow_experimental=true",
        json=VALID_V3_PAYLOAD,
    )
    assert response.status_code == 200
    data = response.json()
    assert "probability" in data
    assert "risk_level" in data
    assert "warning" in data
    assert data["deployment_status"] == "EXPERIMENTAL_NOT_APPROVED"

def test_explain_endpoint_experimental_allowed():
    response = client.post(
        "/models/delivery-delay/explain?allow_experimental=true",
        json=VALID_V3_PAYLOAD,
    )
    assert response.status_code == 200
    data = response.json()
    assert "contributions" in data

def test_metrics_endpoint():
    response = client.get("/models/delivery-delay/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "roc_auc" in data
    assert "deployment_status" in data
