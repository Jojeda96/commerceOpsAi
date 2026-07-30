from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_predict_endpoint_unapproved_model_rejected():
    # Por defecto debe rechazar con 503 porque el modelo no está aprobado por el Quality Gate
    response = client.post(
        "/models/delivery-delay/predict",
        json={
            "seller_state": "SP",
            "customer_state": "RJ",
            "total_freight": 45.0,
            "total_price": 100.0,
            "total_weight_g": 500.0,
            "total_volume_cm3": 4500.0,
            "item_count": 2,
        },
    )
    assert response.status_code == 503
    data = response.json()["detail"]
    assert data["code"] == "MODEL_NOT_APPROVED"

def test_predict_endpoint_experimental_allowed():
    response = client.post(
        "/models/delivery-delay/predict?allow_experimental=true",
        json={
            "seller_state": "SP",
            "customer_state": "RJ",
            "total_freight": 45.0,
            "total_price": 100.0,
            "total_weight_g": 500.0,
            "total_volume_cm3": 4500.0,
            "item_count": 2,
        },
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
        json={
            "seller_state": "SP",
            "customer_state": "RJ",
            "total_freight": 45.0,
            "total_price": 100.0,
            "total_weight_g": 500.0,
            "total_volume_cm3": 4500.0,
            "item_count": 2,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "contributions" in data
    assert data["explanation_scale"] == "XGBOOST_RAW_MARGIN"

def test_metrics_endpoint():
    response = client.get("/models/delivery-delay/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "roc_auc" in data
    assert "deployment_status" in data
