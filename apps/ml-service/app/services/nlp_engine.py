import os
import json
import joblib
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
        self.vectorizer_path = os.path.join(self.processed_dir, "review_tfidf_vectorizer.joblib")

        self.embeddings: Optional[np.ndarray] = None
        self.metadata: Dict[str, Any] = {}
        self.reviews: List[Dict[str, Any]] = []
        self.model = None
        self.vectorizer = None
        self.load_error: Optional[str] = None
        self.load_index()

    @classmethod
    def get_instance(cls) -> "NLPEngine":
        if cls._instance is None:
            cls._instance = NLPEngine()
        return cls._instance

    def load_index(self):
        if not (os.path.exists(self.embeddings_path) and os.path.exists(self.metadata_path)):
            self.load_error = "INDEX_FILES_NOT_FOUND"
            return

        try:
            self.embeddings = np.load(self.embeddings_path)
            with open(self.metadata_path, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)
            self.reviews = self.metadata.get("reviews", [])
            embedding_method = self.metadata.get("embedding_method", "paraphrase-multilingual-MiniLM-L12-v2")
            print(f"[NLPEngine] [OK] Índice NLP cargado ({len(self.reviews)} reseñas, dim={self.embeddings.shape[1]}, método={embedding_method}).")

            if os.path.exists(self.vectorizer_path):
                try:
                    self.vectorizer = joblib.load(self.vectorizer_path)
                    print(f"[NLPEngine] [OK] Vectorizador TF-IDF cargado desde: {self.vectorizer_path}")
                except Exception as e:
                    print(f"[NLPEngine] Warning al cargar vectorizador TF-IDF: {e}")

            try:
                from sentence_transformers import SentenceTransformer
                self.model = SentenceTransformer(embedding_method)
            except Exception as e:
                print(f"[NLPEngine] SentenceTransformer ({embedding_method}) no cargado ({e}). Usando vectorizador TF-IDF si está disponible.")
            self.load_error = None
        except Exception as e:
            self.load_error = f"{type(e).__name__}: {e}"
            print(f"[NLPEngine] Warning al cargar índice NLP: {self.load_error}")

    def search_reviews(
        self,
        query: str,
        top_k: int = 5,
        review_scores: Optional[List[int]] = None,
        categories: Optional[List[str]] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> Dict[str, Any]:
        if self.embeddings is None or len(self.reviews) == 0:
            return {
                "status": "INDEX_UNAVAILABLE",
                "query": query,
                "candidate_count": 0,
                "results": [],
                "method": None,
                "warning": self.load_error or "INDEX_NOT_LOADED",
            }

        method_used = self.metadata.get("embedding_method", "paraphrase-multilingual-MiniLM-L12-v2")
        candidate_indices = list(range(len(self.reviews)))

        # Filtro 1: review_scores (enteros exactos)
        if review_scores and len(review_scores) > 0:
            scores_set = set(int(s) for s in review_scores)
            candidate_indices = [
                i for i in candidate_indices
                if int(self.reviews[i].get("review_score", 1)) in scores_set
            ]

        # Filtro 2: categories (intersección de arrays)
        if categories and len(categories) > 0:
            cats_set = set(c.lower() for c in categories)
            candidate_indices = [
                i for i in candidate_indices
                if any(
                    cat.lower() in cats_set or any(req_cat in cat.lower() for req_cat in cats_set)
                    for cat in (self.reviews[i].get("product_categories") or [])
                )
            ]

        # Filtro 3: date_from / date_to ISO string
        if date_from:
            candidate_indices = [
                i for i in candidate_indices
                if str(self.reviews[i].get("review_creation_date", "")) >= date_from
            ]

        if date_to:
            candidate_indices = [
                i for i in candidate_indices
                if str(self.reviews[i].get("review_creation_date", "")) <= date_to
            ]

        if not candidate_indices:
            return {
                "status": "AVAILABLE",
                "query": query,
                "candidate_count": 0,
                "results": [],
                "method": method_used,
            }

        sub_embeddings = self.embeddings[candidate_indices]

        if self.model is not None:
            query_vector = self.model.encode([query], convert_to_numpy=True)[0]
            norm = np.linalg.norm(query_vector)
            if norm > 0:
                query_vector = query_vector / norm
            scores = np.dot(sub_embeddings, query_vector)
        elif self.vectorizer is not None:
            query_vector = self.vectorizer.transform([query]).toarray()[0]
            norm = np.linalg.norm(query_vector)
            if norm > 0:
                query_vector = query_vector / norm
            scores = np.dot(sub_embeddings, query_vector)
        else:
            query_words = set(query.lower().split())
            scores = []
            for i in candidate_indices:
                text = str(self.reviews[i].get("review_comment_message", "")).lower()
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
                "order_id": rev.get("order_id"),
                "review_score": int(rev.get("review_score", 1)),
                "review_comment": rev.get("review_comment_message", ""),
                "review_creation_date": rev.get("review_creation_date"),
                "product_categories": rev.get("product_categories", []),
                "source_type": rev.get("source_type", "OLIST_REAL"),
                "is_test_fixture": bool(rev.get("is_test_fixture", False)),
                "similarity_score": round(min(0.99, max(0.0, sim)), 4),
            })

        return {
            "status": "AVAILABLE",
            "query": query,
            "candidate_count": len(candidate_indices),
            "results": results,
            "method": method_used,
        }
