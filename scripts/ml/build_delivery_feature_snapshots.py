#!/usr/bin/env python3
"""
Generates point-in-time feature snapshots for all delivered orders using the training feature pipeline.
Output: data/processed/delivery_feature_snapshots.parquet
"""

import os
import sys
from pathlib import Path
import pandas as pd
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.ml.features import add_direct_features
from scripts.ml.temporal_history import add_all_temporal_features
from scripts.ml.feature_snapshot_schema import validate_snapshot_dict

def build_snapshots():
    dataset_path = PROJECT_ROOT / "data" / "processed" / "delivery_model_dataset.parquet"
    out_path = PROJECT_ROOT / "data" / "processed" / "delivery_feature_snapshots.parquet"

    print(f"[Snapshots] Reading dataset from {dataset_path}...")
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found at {dataset_path}. Run build_delivery_dataset.py first.")

    df = pd.read_parquet(dataset_path)

    # Apply feature pipelines
    df = add_direct_features(df)
    df = add_all_temporal_features(df)

    # Standardize column names
    order_id_col = "internal_order_id" if "internal_order_id" in df.columns else "order_id"
    df["order_id"] = df[order_id_col]
    df["feature_contract_version"] = "delivery-features-v3.0.0"
    df["prediction_moment"] = "ORDER_PURCHASE"

    # Fill default category/state if missing to avoid nulls in non-nullable columns
    df["primary_category"] = df["primary_category"].fillna("outros")
    df["primary_seller_state"] = df["primary_seller_state"].fillna("SP")
    df["customer_state"] = df["customer_state"].fillna("SP")

    snapshots_df = pd.DataFrame({
        "order_id": df["order_id"],
        "feature_contract_version": df["feature_contract_version"],
        "prediction_moment": df["prediction_moment"],
        "purchase_date": pd.to_datetime(df["purchase_date"]).dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "primary_seller_state": df["primary_seller_state"].astype(str),
        "customer_state": df["customer_state"].astype(str),
        "primary_category": df["primary_category"].astype(str),
        "total_price": df["total_price"].astype(float),
        "total_freight": df["total_freight"].astype(float),
        "total_weight_g": df["total_weight_g"].astype(float),
        "total_volume_cm3": df["total_volume_cm3"].astype(float),
        "item_count": df["item_count"].astype(int),
        "seller_count": df["seller_count"].astype(int),
        "estimated_delivery_days": df["estimated_delivery_days"].astype(float),
        "shipping_window_days": df["shipping_window_days"].astype(float),
        "route_distance_km": df["route_distance_km"].astype(float),
        "purchase_dow": df["purchase_dow"].astype(int),
        "purchase_hour": df["purchase_hour"].astype(int),
        "purchase_month": df["purchase_month"].astype(int),
        "purchase_week": df["purchase_week"].astype(int),
        "seller_prior_orders": df["seller_prior_orders"].astype(int),
        "seller_prior_late_rate_smoothed": df["seller_prior_late_rate_smoothed"].astype(float),
        "route_prior_orders": df["route_prior_orders"].astype(int),
        "route_prior_late_rate_smoothed": df["route_prior_late_rate_smoothed"].astype(float),
        "category_prior_orders": df["category_prior_orders"].astype(int),
        "category_prior_late_rate_smoothed": df["category_prior_late_rate_smoothed"].astype(float),
        "is_delayed": df["is_delayed"].astype(bool),
    })

    # Validate first row schema sample
    sample_dict = snapshots_df.iloc[0].to_dict()
    errors = validate_snapshot_dict(sample_dict)
    if errors:
        raise ValueError(f"Snapshot validation errors in build script: {errors}")

    print(f"[Snapshots] Successfully generated {len(snapshots_df)} feature snapshots.")
    snapshots_df.to_parquet(out_path, index=False)
    print(f"[Snapshots] Saved to {out_path}")
    return snapshots_df

if __name__ == "__main__":
    build_snapshots()
