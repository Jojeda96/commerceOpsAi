import os
import sys
import json
import numpy as np

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROCESSED_DIR = os.path.join(ROOT_DIR, "data", "processed")
FIXTURE_PATH = os.path.join(ROOT_DIR, "data", "fixtures", "sample-1000-orders.json")

def load_reviews():
    """
    Intenta cargar reseñas de PostgreSQL o del fixture local.
    """
    db_url = os.getenv("DATABASE_URL")
    if db_url and "postgresql" in db_url:
        try:
            print("🔗 Intentando cargar reseñas desde PostgreSQL...")
            from sqlalchemy import create_engine
            import pandas as pd
            engine = create_engine(db_url)
            query = """
            SELECT 
                review_id,
                order_id,
                review_score,
                review_comment_message
            FROM olist_order_reviews
            WHERE review_comment_message IS NOT NULL AND review_comment_message != ''
            LIMIT 2000
            """
            df = pd.read_sql(query, engine)
            if not df.empty:
                print(f"✅ Cargadas {len(df)} reseñas desde PostgreSQL.")
                return df.to_dict(orient="records")
        except Exception as e:
            print(f"⚠️ Falló conexión DB ({e}). Usando fallback a fixture local.")

    # Fallback a sample-1000-orders.json
    print(f"📦 Cargando reseñas de fallback desde: {FIXTURE_PATH}")
    if not os.path.exists(FIXTURE_PATH):
        raise FileNotFoundError(f"No se encontró el archivo de datos: {FIXTURE_PATH}")

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
            })

    # Si el fixture no contiene reseñas con comentario, agregar ejemplos sintéticos representativos del dataset Olist
    if not valid_reviews:
        valid_reviews = [
            {"review_id": "rev-101", "review_score": 1, "review_comment_message": "O produto demorou muito para chegar, atraso absurdo na entrega."},
            {"review_id": "rev-102", "review_score": 1, "review_comment_message": "Péssimo atendimento do vendedor, caixa veio totalmente amassada e quebrada."},
            {"review_id": "rev-103", "review_score": 2, "review_comment_message": "Produto diferente do anunciado, qualidade ruim e demora no transporte."},
            {"review_id": "rev-104", "review_score": 5, "review_comment_message": "Excelente produto, chegou muito rápido antes do prazo estimado!"},
            {"review_id": "rev-105", "review_score": 4, "review_comment_message": "Muito bom, atendeu às expectativas, embalagem bem protegida."},
        ]

    print(f"✅ Cargadas {len(valid_reviews)} reseñas válidas.")
    return valid_reviews

def generate_embeddings():
    os.makedirs(PROCESSED_DIR, exist_ok=True)
    reviews = load_reviews()
    texts = [r["review_comment_message"] for r in reviews]

    print("⚡ Generando embeddings NLP con modelo SentenceTransformers ('all-MiniLM-L6-v2')...")
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer("all-MiniLM-L6-v2")
        embeddings = model.encode(texts, show_progress_bar=True, convert_to_numpy=True)
        method_used = "all-MiniLM-L6-v2"
    except Exception as e:
        print(f"⚠️ SentenceTransformers no disponible o error de descarga ({e}). Usando TF-IDF Vectorizer fallback.")
        from sklearn.feature_extraction.text import TfidfVectorizer
        vectorizer = TfidfVectorizer(max_features=384)
        sparse_matrix = vectorizer.fit_transform(texts)
        embeddings = sparse_matrix.toarray().astype(np.float32)
        method_used = "tfidf_fallback_384d"

    # Normalizar embeddings para cálculo directo de similitud de coseno mediante producto escalar
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    normalized_embeddings = (embeddings / norms).astype(np.float32)

    # Guardar matriz
    npy_path = os.path.join(PROCESSED_DIR, "review_embeddings.npy")
    np.save(npy_path, normalized_embeddings)
    print(f"💾 Matriz de embeddings ({normalized_embeddings.shape}) guardada en: {npy_path}")

    # Guardar metadatos
    metadata = {
        "embedding_method": method_used,
        "embedding_dimension": normalized_embeddings.shape[1],
        "count": len(reviews),
        "reviews": reviews,
    }
    meta_path = os.path.join(PROCESSED_DIR, "reviews_metadata.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    print(f"📋 Metadatos de reseñas guardados en: {meta_path}")

    print("\n🎉 Generación de embeddings NLP completada con éxito!")

if __name__ == "__main__":
    generate_embeddings()
