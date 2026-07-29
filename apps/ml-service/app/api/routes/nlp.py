from fastapi import APIRouter
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
    return SearchResponse(
        query=res["query"],
        results=[SearchResponseItem(**r) for r in res["results"]],
        method=res["method"],
    )
