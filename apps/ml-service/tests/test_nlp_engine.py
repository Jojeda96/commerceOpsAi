import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.nlp_engine import NLPEngine

client = TestClient(app)

def test_nlp_engine_no_mock_reviews_when_unavailable():
    engine = NLPEngine.get_instance()
    old_embeddings = engine.embeddings
    engine.embeddings = None

    try:
        res = engine.search_reviews("atraso na entrega")
        assert res["status"] == "INDEX_UNAVAILABLE"
        assert res["candidate_count"] == 0
        assert res["results"] == []
    finally:
        engine.embeddings = old_embeddings

def test_nlp_route_returns_503_when_unavailable():
    engine = NLPEngine.get_instance()
    old_embeddings = engine.embeddings
    engine.embeddings = None

    try:
        response = client.post("/nlp/reviews/search", json={"query": "demora"})
        assert response.status_code == 503
        data = response.json()["detail"]
        assert data["code"] == "NLP_RESOURCE_NOT_FOUND"

        topics_response = client.get("/nlp/review-topics")
        assert topics_response.status_code == 503
        topics_data = topics_response.json()["detail"]
        assert topics_data["code"] == "NLP_RESOURCE_NOT_FOUND"
    finally:
        engine.embeddings = old_embeddings

def test_nlp_engine_filters_if_index_loaded():
    engine = NLPEngine.get_instance()
    if engine.embeddings is None:
        pytest.skip("Índice NLP no generado en entorno local.")

    res = engine.search_reviews("demora", review_scores=[1])
    assert res["status"] == "AVAILABLE"
    for r in res["results"]:
        assert r["review_score"] == 1
        assert "source_type" in r
