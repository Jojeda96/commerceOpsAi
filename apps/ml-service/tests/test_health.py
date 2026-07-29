from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_predict_endpoint():
    response = client.post(
        "/models/delivery-delay/predict",
        json={
            "seller_state": "SP",
            "customer_state": "RJ",
            "freight_value": 45.0,
            "item_count": 2,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "probability" in data
    assert "risk_level" in data
