from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any

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
    method: str = "semantic_embeddings"

@router.post("/reviews/search", response_model=SearchResponse)
async def search_reviews(request: SearchRequest):
    # Demostración de búsqueda semántica / fallback estructurado
    mock_results = [
        SearchResponseItem(
            review_id="rev-101",
            review_score=1,
            review_comment=f"O produto demorou muito para chegar. Resposta a query: {request.query}",
            similarity_score=0.89
        ),
        SearchResponseItem(
            review_id="rev-102",
            review_score=2,
            review_comment="Péssima entrega e caixa amassada.",
            similarity_score=0.82
        ),
        SearchResponseItem(
            review_id="rev-103",
            review_score=1,
            review_comment="Vendedor não respondeu minhas mensagens sobre o atraso.",
            similarity_score=0.78
        )
    ]
    return SearchResponse(
        query=request.query,
        results=mock_results[:request.top_k]
    )
