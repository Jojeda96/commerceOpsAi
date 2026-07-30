from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from app.services.nlp_engine import NLPEngine

router = APIRouter(prefix="/nlp", tags=["NLP"])

class SearchRequest(BaseModel):
    query: str
    top_k: int = 5
    review_scores: Optional[List[int]] = None
    categories: Optional[List[str]] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None

class SearchResponseItem(BaseModel):
    review_id: str
    review_score: int
    review_comment: str
    similarity_score: float

class SearchResponse(BaseModel):
    query: str
    results: List[SearchResponseItem]
    method: str

@router.post("/reviews/search", response_model=SearchResponse)
async def search_reviews(request: SearchRequest):
    engine = NLPEngine.get_instance()
    res = engine.search_reviews(
        query=request.query,
        top_k=request.top_k,
        review_scores=request.review_scores,
        categories=request.categories,
        date_from=request.date_from,
        date_to=request.date_to,
    )
    if res.get("status") == "INDEX_UNAVAILABLE":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "NLP_RESOURCE_NOT_FOUND",
                "message": res.get("warning", "Indice de reseñas NLP no disponible."),
            },
        )
    return SearchResponse(
        query=res["query"],
        results=[SearchResponseItem(**r) for r in res["results"]],
        method=res.get("method", "UNKNOWN"),
    )

@router.get("/review-topics")
async def get_review_topics():
    engine = NLPEngine.get_instance()
    if engine.embeddings is None or len(engine.reviews) == 0:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "NLP_RESOURCE_NOT_FOUND",
                "message": engine.load_error or "Modelo o indice NLP no cargado.",
            },
        )
    return {
        "status": "AVAILABLE",
        "topics": engine.metadata.get("topics", []),
    }
