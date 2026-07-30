#!/usr/bin/env python3
"""
Syncs point-in-time feature snapshots from parquet into PostgreSQL table delivery_feature_snapshots.
"""

import os
import sys
from pathlib import Path
import pandas as pd
from sqlalchemy import create_engine, text

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.ml.build_delivery_feature_snapshots import build_snapshots

def sync_snapshots():
    parquet_path = PROJECT_ROOT / "data" / "processed" / "delivery_feature_snapshots.parquet"
    if not parquet_path.exists():
        print(f"[SyncSnapshots] Parquet file not found. Generating snapshots first...")
        df = build_snapshots()
    else:
        df = pd.read_parquet(parquet_path)

    db_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/commerce_ops")
    print(f"[SyncSnapshots] Connecting to PostgreSQL...")
    engine = create_engine(db_url)

    # Rename columns to camelCase or DB map names if necessary
    # In Prisma schema:
    # order_id -> order_id
    # feature_contract_version -> feature_contract_version
    # prediction_moment -> prediction_moment
    # purchase_date -> purchase_date
    # primary_seller_state -> primary_seller_state
    # customer_state -> customer_state
    # primary_category -> primary_category
    # total_price -> total_price
    # total_freight -> total_freight
    # total_weight_g -> total_weight_g
    # total_volume_cm3 -> total_volume_cm3
    # item_count -> item_count
    # seller_count -> seller_count
    # estimated_delivery_days -> estimated_delivery_days
    # shipping_window_days -> shipping_window_days
    # route_distance_km -> route_distance_km
    # purchase_dow -> purchase_dow
    # purchase_hour -> purchase_hour
    # purchase_month -> purchase_month
    # purchase_week -> purchase_week
    # seller_prior_orders -> seller_prior_orders
    # seller_prior_late_rate_smoothed -> seller_prior_late_rate_smoothed
    # route_prior_orders -> route_prior_orders
    # route_prior_late_rate_smoothed -> route_prior_late_rate_smoothed
    # category_prior_orders -> category_prior_orders
    # category_prior_late_rate_smoothed -> category_prior_late_rate_smoothed
    # is_delayed -> is_delayed

    db_df = df.copy()
    if "id" not in db_df.columns:
        import uuid
        db_df["id"] = [str(uuid.uuid4()) for _ in range(len(db_df))]
    
    db_df["purchase_date"] = pd.to_datetime(db_df["purchase_date"])

    print(f"[SyncSnapshots] Writing {len(db_df)} snapshot rows to PostgreSQL table delivery_feature_snapshots...")
    try:
        # Truncate table first for clean sync if table exists
        with engine.begin() as conn:
            conn.execute(text("TRUNCATE TABLE delivery_feature_snapshots CASCADE;"))
        db_df.to_sql("delivery_feature_snapshots", engine, if_exists="append", index=False, chunksize=1000)
        print("[SyncSnapshots] [OK] Successfully synced feature snapshots to PostgreSQL.")
    except Exception as exc:
        print(f"[SyncSnapshots] Database sync skipped or failed (will proceed if DB unavailable): {exc}")

if __name__ == "__main__":
    sync_snapshots()
