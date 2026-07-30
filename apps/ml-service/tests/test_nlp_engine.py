import sys
import os
import pytest
from app.services.nlp_engine import NLPEngine


def test_nlp_engine_no_mock_reviews_when_unavailable():
    engine = NLPEngine()
    # Force unavailable state for test
    old_embeddings = engine.embeddings
    engine.embeddings = None

    try:
        res = engine.search_reviews("atraso na entrega")
        assert res["status"] == "INDEX_UNAVAILABLE"
        assert res["candidate_count"] == 0
        assert res["results"] == []
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
