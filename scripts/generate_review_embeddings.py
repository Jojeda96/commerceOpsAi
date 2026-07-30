import os
import sys
import json
import argparse
import joblib
import numpy as np

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROCESSED_DIR = os.path.join(ROOT_DIR, "data", "processed")
FIXTURE_PATH = os.path.join(ROOT_DIR, "data", "fixtures", "sample-1000-orders.json")

def load_reviews(source: str):
    if source == "database":
        db_url = os.getenv("DATABASE_URL")
        if not db_url or "postgresql" not in db_url:
            raise RuntimeError("DATABASE_URL no configurada o no es PostgreSQL. No se pueden cargar reseñas reales.")

        print("🔗 Cargando reseñas reales desde PostgreSQL (sin LIMIT artificial)...")
        from sqlalchemy import create_engine
        import pandas as pd
        engine = create_engine(db_url)
        query = """
        SELECT 
            r.review_id,
            r.order_id,
            r.review_score,
            r.review_comment_message,
            r.review_creation_date,
            ARRAY_AGG(DISTINCT p.product_category_name) FILTER (WHERE p.product_category_name IS NOT NULL) AS product_categories
        FROM olist_order_reviews r
        JOIN olist_orders o ON r.order_id = o.id
        LEFT JOIN olist_order_items i ON o.id = i.order_id
        LEFT JOIN olist_products p ON i.product_id = p.id
        WHERE r.review_comment_message IS NOT NULL AND TRIM(r.review_comment_message) != ''
        GROUP BY r.review_id, r.order_id, r.review_score, r.review_comment_message, r.review_creation_date
        """
        df = pd.read_sql(query, engine)
        if df.empty:
            raise RuntimeError("No se encontraron reseñas reales en PostgreSQL. Importe Olist antes de generar el índice.")

        print(f"✅ Cargadas {len(df)} reseñas reales desde PostgreSQL.")
        records = []
        for row in df.to_dict(orient="records"):
            creation_date = row.get("review_creation_date")
            creation_str = creation_date.isoformat() if hasattr(creation_date, "isoformat") else str(creation_date or "")
            cats = row.get("product_categories")
            categories_list = list(cats) if isinstance(cats, (list, tuple)) else ([cats] if cats else [])

            records.append({
                "review_id": row["review_id"],
                "order_id": row["order_id"],
                "review_score": int(row["review_score"]),
                "review_comment_message": str(row["review_comment_message"]).strip(),
                "review_creation_date": creation_str,
                "product_categories": categories_list,
                "source_type": "OLIST_REAL",
                "is_test_fixture": False,
            })
        return records

    elif source == "test-fixture":
        print(f"📦 Cargando reseñas de test fixture desde: {FIXTURE_PATH}")
        if not os.path.exists(FIXTURE_PATH):
            raise FileNotFoundError(f"No se encontró el archivo de datos fixture: {FIXTURE_PATH}")

        with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)

        reviews = data.get("reviews", [])
        valid_reviews = []
        for r in reviews:
            comment = r.get("review_comment_message") or r.get("review_comment_title")
            if comment and str(comment).strip():
                valid_reviews.append({
                    "review_id": r.get("review_id", f"rev-{len(valid_reviews)}"),
                    "order_id": r.get("order_id"),
                    "review_score": int(r.get("review_score", 1)),
                    "review_comment_message": str(comment).strip(),
                    "review_creation_date": r.get("review_creation_date", "2018-01-01T00:00:00"),
                    "product_categories": r.get("product_categories", ["perfumaria"]),
                    "source_type": "TEST_FIXTURE",
                    "is_test_fixture": True,
                })
        return valid_reviews
    else:
        raise ValueError(f"Fuente no soportada: {source}")

def generate_embeddings(source: str = "database"):
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    reviews = load_reviews(source)
    texts = [r["review_comment_message"] for r in reviews]

    print(f"⚡ Generando embeddings NLP para {len(texts)} reseñas...")
    vectorizer_path = os.path.join(PROCESSED_DIR, "review_tfidf_vectorizer.joblib")

    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
        embeddings = model.encode(texts, show_progress_bar=True, convert_to_numpy=True)
        method_used = "paraphrase-multilingual-MiniLM-L12-v2"
    except Exception as e:
        print(f"⚠️ SentenceTransformers multilingual no disponible ({e}). Usando TfidfVectorizer.")
        from sklearn.feature_extraction.text import TfidfVectorizer
        vectorizer = TfidfVectorizer(max_features=384)
        sparse_matrix = vectorizer.fit_transform(texts)
        embeddings = sparse_matrix.toarray().astype(np.float32)
        joblib.dump(vectorizer, vectorizer_path)
        print(f"💾 Vectorizador TF-IDF persistido en: {vectorizer_path}")
        method_used = "tfidf_vectorizer_384d"

    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    normalized_embeddings = (embeddings / norms).astype(np.float32)

    npy_path = os.path.join(PROCESSED_DIR, "review_embeddings.npy")
    np.save(npy_path, normalized_embeddings)
    print(f"💾 Matriz de embeddings ({normalized_embeddings.shape}) guardada en: {npy_path}")

    metadata = {
        "embedding_method": method_used,
        "embedding_dimension": normalized_embeddings.shape[1],
        "count": len(reviews),
        "source_type": "OLIST_REAL" if source == "database" else "TEST_FIXTURE",
        "reviews": reviews,
    }
    meta_path = os.path.join(PROCESSED_DIR, "reviews_metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"📋 Metadatos de reseñas guardados en: {meta_path}")
    print("\n🎉 Índice vectorial NLP generado con éxito!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generador de embeddings de reseñas NLP")
    parser.add_argument("--source", choices=["database", "test-fixture"], default="database", help="Fuente de reseñas")
    args = parser.parse_args()
    generate_embeddings(source=args.source)
