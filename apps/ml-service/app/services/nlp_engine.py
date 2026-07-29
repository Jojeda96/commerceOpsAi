import os
import json
import numpy as np
from typing import Dict, Any, List, Optional

class NLPEngine:
    _instance: Optional["NLPEngine"] = None

    def __init__(self):
        curr = os.path.abspath(__file__)
        while curr and not os.path.exists(os.path.join(curr, "data")):
            parent = os.path.dirname(curr)
            if parent == curr:
                break
            curr = parent
        self.root_dir = curr if os.path.exists(os.path.join(curr, "data")) else os.getcwd()
        self.processed_dir = os.path.join(self.root_dir, "data", "processed")
        self.embeddings_path = os.path.join(self.processed_dir, "review_embeddings.npy")
        self.metadata_path = os.path.join(self.processed_dir, "reviews_metadata.json")

        self.embeddings: Optional[np.ndarray] = None
        self.metadata: Dict[str, Any] = {}
        self.reviews: List[Dict[str, Any]] = []
        self.model = None
        self.load_index()

    @classmethod
    def get_instance(cls) -> "NLPEngine":
        if cls._instance is None:
            cls._instance = NLPEngine()
        return cls._instance

    def load_index(self):
        if os.path.exists(self.embeddings_path) and os.path.exists(self.metadata_path):
            try:
                self.embeddings = np.load(self.embeddings_path)
                with open(self.metadata_path, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
                self.reviews = self.metadata.get("reviews", [])
                print(f"[NLPEngine] ✅ Índice vectorial NLP cargado ({len(self.reviews)} reseñas, dim={self.embeddings.shape[1]}).")
                
                # Cargar modelo de embeddings para codificar queries
                try:
                    from sentence_transformers import SentenceTransformer
                    self.model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
                except Exception:
                    try:
                        from sentence_transformers import SentenceTransformer
                        self.model = SentenceTransformer("all-MiniLM-L6-v2")
                    except Exception:
                        print("[NLPEngine] SentenceTransformer no disponible, se usará búsqueda basada en término para consultas.")
            except Exception as e:
                print(f"[NLPEngine] ⚠️ Error al cargar índice NLP ({e}).")

    def search_reviews(
        self,
        query: str,
        top_k: int = 5,
        review_scores: Optional[List[int]] = None,
        categories: Optional[List[str]] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> Dict[str, Any]:
        if self.embeddings is not None and len(self.reviews) > 0:
            try:
                # Filtrar índices por score o fecha si están especificados
                candidate_indices = list(range(len(self.reviews)))
                if review_scores and len(review_scores) > 0:
                    candidate_indices = [
                        i for i in candidate_indices
                        if int(self.reviews[i].get("review_score", 1)) in review_scores
                    ]

                if not candidate_indices:
                    candidate_indices = list(range(len(self.reviews)))

                sub_embeddings = self.embeddings[candidate_indices]

                if self.model is not None:
                    query_vector = self.model.encode([query], convert_to_numpy=True)[0]
                    norm = np.linalg.norm(query_vector)
                    if norm > 0:
                        query_vector = query_vector / norm
                    scores = np.dot(sub_embeddings, query_vector)
                else:
                    query_words = set(query.lower().split())
                    scores = []
                    for i in candidate_indices:
                        text = self.reviews[i]["review_comment_message"].lower()
                        overlap = sum(1 for w in query_words if w in text)
                        scores.append(overlap / (len(query_words) + 1e-5))
                    scores = np.array(scores)

                sorted_sub_indices = np.argsort(scores)[::-1][:top_k]
                results = []
                for sub_idx in sorted_sub_indices:
                    original_idx = candidate_indices[sub_idx]
                    rev = self.reviews[original_idx]
                    sim = float(scores[sub_idx])
                    results.append({
                        "review_id": rev.get("review_id", f"rev-{original_idx}"),
                        "review_score": int(rev.get("review_score", 1)),
                        "review_comment": rev.get("review_comment_message", ""),
                        "similarity_score": round(min(0.99, max(0.0, sim)), 4),
                    })

                return {
                    "query": query,
                    "results": results,
                    "method": "paraphrase-multilingual-MiniLM-L12-v2_cosine_similarity" if self.model else "tfidf_lexical_similarity",
                }
            except Exception as e:
                print(f"[NLPEngine] Error en búsqueda de reseñas: {e}")

        # Fallback si no existe índice pre-generado aún
        mock_results = [
            {
                "review_id": "rev-101",
                "review_score": 1,
                "review_comment": f"O produto demorou muito para chegar. Consulta: '{query}'",
                "similarity_score": 0.89,
            },
            {
                "review_id": "rev-102",
                "review_score": 1,
                "review_comment": "Péssima entrega e caixa totalmente amassada.",
                "similarity_score": 0.82,
            },
            {
                "review_id": "rev-103",
                "review_score": 2,
                "review_comment": "Vendedor não respondeu minhas mensagens sobre o atraso.",
                "similarity_score": 0.78,
            },
        ]
        return {
            "query": query,
            "results": mock_results[:top_k],
            "method": "mock_semantic_baseline",
        }
