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
    assert data["model_version"].startswith("delivery-xgb-v1")

def test_explain_endpoint():
    response = client.post(
        "/models/delivery-delay/explain",
        json={
            "seller_state": "SP",
            "customer_state": "RJ",
            "freight_value": 45.0,
            "item_count": 2,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "contributions" in data

def test_metrics_endpoint():
    response = client.get("/models/delivery-delay/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "accuracy" in data
    assert "XGBoost Classifier" in data["algorithm"]

def test_nlp_search_endpoint():
    response = client.post(
        "/nlp/reviews/search",
        json={
            "query": "atraso na entrega produto danificado",
            "top_k": 3,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert len(data["results"]) > 0
    assert "similarity_score" in data["results"][0]
