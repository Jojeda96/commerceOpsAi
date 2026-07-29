import os
import sys
import pandas as pd

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "raw")

FILES = {
    "olist_customers_dataset.csv": ["customer_id", "customer_unique_id", "customer_zip_code_prefix", "customer_city", "customer_state"],
    "olist_orders_dataset.csv": ["order_id", "customer_id", "order_status", "order_purchase_timestamp", "order_approved_at", "order_delivered_carrier_date", "order_delivered_customer_date", "order_estimated_delivery_date"],
    "olist_order_items_dataset.csv": ["order_id", "order_item_id", "product_id", "seller_id", "shipping_limit_date", "price", "freight_value"],
    "olist_order_payments_dataset.csv": ["order_id", "payment_sequential", "payment_type", "payment_installments", "payment_value"],
    "olist_order_reviews_dataset.csv": ["review_id", "order_id", "review_score", "review_comment_title", "review_comment_message", "review_creation_date", "review_answer_timestamp"],
    "olist_products_dataset.csv": ["product_id", "product_category_name", "product_name_lenght", "product_description_lenght", "product_photos_qty", "product_weight_g", "product_length_cm", "product_height_cm", "product_width_cm"],
    "olist_sellers_dataset.csv": ["seller_id", "seller_zip_code_prefix", "seller_city", "seller_state"],
    "olist_geolocation_dataset.csv": ["geolocation_zip_code_prefix", "geolocation_lat", "geolocation_lng", "geolocation_city", "geolocation_state"],
    "product_category_name_translation.csv": ["product_category_name", "product_category_name_english"],
}

def validate():
    print("=== Validando Dataset Olist en data/raw ===")
    all_ok = True
    for filename, expected_cols in FILES.items():
        filepath = os.path.join(RAW_DIR, filename)
        if not os.path.exists(filepath):
            print(f"[FAIL] FALTA: {filename}")
            all_ok = False
            continue

        try:
            df = pd.read_csv(filepath, nrows=5)
            cols = list(df.columns)
            missing = [c for c in expected_cols if c not in cols]
            if missing:
                print(f"[FAIL] COLUMNAS FALTANTES en {filename}: {missing}")
                all_ok = False
            else:
                row_count = sum(1 for _ in open(filepath, encoding="utf-8", errors="ignore")) - 1
                print(f"[OK] {filename}: {row_count:,} registros | Columnas OK")
        except Exception as e:
            print(f"[FAIL] ERROR leyendo {filename}: {e}")
            all_ok = False

    if all_ok:
        print("\n[SUCCESS] ¡Todos los archivos CSV pasaron la validacion exitosamente!")
        sys.exit(0)
    else:
        print("\n[ERROR] Hubo errores en la validacion del dataset.")
        sys.exit(1)

if __name__ == "__main__":
    validate()
