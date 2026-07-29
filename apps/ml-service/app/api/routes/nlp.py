from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any
from app.services.nlp_engine import NLPEngine

router = APIRouter(prefix="/nlp", tags=["NLP"])

class SearchRequest(BaseModel):
    query: str
    top_k: int = 5

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
    res = engine.search_reviews(request.query, request.top_k)
    return SearchResponse(
        query=res["query"],
        results=[SearchResponseItem(**r) for r in res["results"]],
        method=res["method"],
    )
