import os
import sys
import argparse
import json
import hashlib
from datetime import datetime, timezone
import pandas as pd
import numpy as np

# Asegurar encoding UTF-8 en stdout/stderr para Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


MIN_ORDERS_FOR_FULL_TRAINING = 50_000
MIN_POSITIVES_FOR_FULL_TRAINING = 1_000


def get_root_dir() -> str:
    curr = os.path.abspath(__file__)
    while curr and not os.path.exists(os.path.join(curr, "data")):
        parent = os.path.dirname(curr)
        if parent == curr:
            break
        curr = parent
    return curr if os.path.exists(os.path.join(curr, "data")) else os.getcwd()


def load_raw_data(raw_dir: str):
    orders = pd.read_csv(os.path.join(raw_dir, "olist_orders_dataset.csv"))
    customers = pd.read_csv(os.path.join(raw_dir, "olist_customers_dataset.csv"))
    items = pd.read_csv(os.path.join(raw_dir, "olist_order_items_dataset.csv"))
    sellers = pd.read_csv(os.path.join(raw_dir, "olist_sellers_dataset.csv"))
    products = pd.read_csv(os.path.join(raw_dir, "olist_products_dataset.csv"))
    geo = pd.read_csv(os.path.join(raw_dir, "olist_geolocation_dataset.csv"))
    return orders, customers, items, sellers, products, geo


def build_dataset(mode: str = "full"):
    root_dir = get_root_dir()
    raw_dir = os.path.join(root_dir, "data", "raw")
    processed_dir = os.path.join(root_dir, "data", "processed")
    fixtures_dir = os.path.join(root_dir, "data", "fixtures")
    os.makedirs(processed_dir, exist_ok=True)
    os.makedirs(fixtures_dir, exist_ok=True)

    print(f"[BuildDataset] Cargando datos raw desde: {raw_dir}")
    orders_df, customers_df, items_df, sellers_df, products_df, geo_df = load_raw_data(raw_dir)

    # 1. Geolocation Centroids por zip_code_prefix
    geo_centroids = (
        geo_df.groupby("geolocation_zip_code_prefix", as_index=False)
        .agg(
            lat=("geolocation_lat", "mean"),
            lng=("geolocation_lng", "mean"),
        )
    )

    # 2. Filtrar pedidos entregados válidos
    delivered_orders = orders_df[
        (orders_df["order_status"] == "delivered")
        & (orders_df["order_delivered_customer_date"].notna())
        & (orders_df["order_estimated_delivery_date"].notna())
    ].copy()

    # Parsear fechas
    date_cols = [
        "order_purchase_timestamp",
        "order_estimated_delivery_date",
        "order_delivered_customer_date",
    ]
    for col in date_cols:
        delivered_orders[col] = pd.to_datetime(delivered_orders[col])

    # Target: is_delayed
    delivered_orders["is_delayed"] = (
        delivered_orders["order_delivered_customer_date"] > delivered_orders["order_estimated_delivery_date"]
    ).astype(int)

    # 3. Join Customers
    customers_geo = pd.merge(
        customers_df,
        geo_centroids,
        left_on="customer_zip_code_prefix",
        right_on="geolocation_zip_code_prefix",
        how="left",
    ).rename(columns={"lat": "customer_lat", "lng": "customer_lng"})

    orders_customers = pd.merge(
        delivered_orders,
        customers_geo,
        on="customer_id",
        how="inner",
    )

    # 4. Join Items, Sellers, Products
    sellers_geo = pd.merge(
        sellers_df,
        geo_centroids,
        left_on="seller_zip_code_prefix",
        right_on="geolocation_zip_code_prefix",
        how="left",
    ).rename(columns={"lat": "seller_lat", "lng": "seller_lng"})

    items_full = pd.merge(items_df, sellers_geo, on="seller_id", how="inner")
    items_full = pd.merge(items_full, products_df, on="product_id", how="inner")

    items_full["shipping_limit_date"] = pd.to_datetime(items_full["shipping_limit_date"])
    items_full["item_volume_cm3"] = (
        items_full["product_length_cm"].fillna(0)
        * items_full["product_height_cm"].fillna(0)
        * items_full["product_width_cm"].fillna(0)
    )
    items_full["item_value"] = items_full["price"].fillna(0) + items_full["freight_value"].fillna(0)

    # 5. Determinar Seller Principal por Pedido (mayor GMV en el pedido)
    seller_value = (
        items_full.groupby(["order_id", "seller_id"], as_index=False)
        .agg(
            seller_gmv=("item_value", "sum"),
            seller_state=("seller_state", "first"),
            seller_lat=("seller_lat", "first"),
            seller_lng=("seller_lng", "first"),
        )
    )

    primary_seller = (
        seller_value.sort_values(["order_id", "seller_gmv"], ascending=[True, False])
        .drop_duplicates("order_id")
        .rename(
            columns={
                "seller_id": "primary_seller_id",
                "seller_state": "primary_seller_state",
                "seller_lat": "primary_seller_lat",
                "seller_lng": "primary_seller_lng",
            }
        )
    )

    # 6. Determinar Categoría Principal por Pedido (mayor GMV)
    category_value = (
        items_full.groupby(["order_id", "product_category_name"], as_index=False)
        .agg(category_gmv=("item_value", "sum"))
    )
    primary_category = (
        category_value.sort_values(["order_id", "category_gmv"], ascending=[True, False])
        .drop_duplicates("order_id")
        .rename(columns={"product_category_name": "primary_category"})[["order_id", "primary_category"]]
    )

    # 7. Agrupar ítems a nivel de pedido
    order_items_agg = (
        items_full.groupby("order_id", as_index=False)
        .agg(
            total_price=("price", "sum"),
            total_freight=("freight_value", "sum"),
            total_weight_g=("product_weight_g", "sum"),
            total_volume_cm3=("item_volume_cm3", "sum"),
            item_count=("order_item_id", "count"),
            seller_count=("seller_id", "nunique"),
            seller_state_count=("seller_state", "nunique"),
            first_shipping_limit=("shipping_limit_date", "min"),
            last_shipping_limit=("shipping_limit_date", "max"),
        )
    )

    # 8. Unir todo a nivel de pedido
    dataset = pd.merge(orders_customers, order_items_agg, on="order_id", how="inner")
    dataset = pd.merge(dataset, primary_seller[["order_id", "primary_seller_id", "primary_seller_state", "primary_seller_lat", "primary_seller_lng"]], on="order_id", how="left")
    dataset = pd.merge(dataset, primary_category, on="order_id", how="left")

    dataset = dataset.rename(columns={"order_id": "internal_order_id", "order_purchase_timestamp": "purchase_date", "order_estimated_delivery_date": "estimated_date", "order_delivered_customer_date": "delivered_date"})

    # 9. Assertions de Integridad
    assert dataset["internal_order_id"].is_unique, "internal_order_id no es único"
    assert dataset["is_delayed"].isin([0, 1]).all(), "is_delayed debe ser binario [0, 1]"
    assert (dataset["delivered_date"] >= dataset["purchase_date"]).all(), "delivered_date debe ser >= purchase_date"

    positives = int(dataset["is_delayed"].sum())
    total_rows = len(dataset)
    print(f"[BuildDataset] Total de pedidos procesados: {total_rows}, Positivos (Atrasos): {positives} ({positives/total_rows:.4%})")

    if mode == "full":
        if total_rows < MIN_ORDERS_FOR_FULL_TRAINING:
            raise ValueError(f"Dataset insuficiente para entrenamiento completo: {total_rows} pedidos (mínimo {MIN_ORDERS_FOR_FULL_TRAINING}).")
        if positives < MIN_POSITIVES_FOR_FULL_TRAINING:
            raise ValueError(f"Clase positiva insuficiente para entrenamiento completo: {positives} (mínimo {MIN_POSITIVES_FOR_FULL_TRAINING}).")

    # Guardar Parquet
    parquet_path = os.path.join(processed_dir, "delivery_model_dataset.parquet")
    dataset.to_parquet(parquet_path, index=False)
    print(f"[BuildDataset] [OK] Parquet guardado en: {parquet_path}")

    # Guardar Fixture pequeño
    fixture_path = os.path.join(fixtures_dir, "ml-delivery-small.parquet")
    dataset.head(1000).to_parquet(fixture_path, index=False)
    print(f"[BuildDataset] [OK] Fixture guardado en: {fixture_path}")

    # Guardar Manifest
    query_sig = "SELECT_FULL_OLIST_DELIVERED_ORDERS_V2"
    manifest = {
        "dataset_version": "delivery-dataset-v2",
        "prediction_moment": "ORDER_PURCHASE",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "query_sha256": hashlib.sha256(query_sig.encode()).hexdigest(),
        "row_count": total_rows,
        "positive_count": positives,
        "positive_ratio": round(positives / total_rows, 4),
        "date_min": dataset["purchase_date"].min().isoformat(),
        "date_max": dataset["purchase_date"].max().isoformat(),
    }
    manifest_path = os.path.join(processed_dir, "delivery_model_manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"[BuildDataset] [OK] Manifest guardado en: {manifest_path}")

    return dataset, manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build delivery ML dataset from Olist raw CSVs.")
    parser.add_argument("--mode", type=str, choices=["full", "fixture"], default="full", help="Build mode: full or fixture")
    args = parser.parse_args()
    build_dataset(mode=args.mode)
