import numpy as np
import pandas as pd
from scripts.ml.available_history import add_available_outcome_history


def add_prior_group_stats(
    df: pd.DataFrame,
    group_col: str,
    prefix: str,
    strength: float = 20.0,
) -> pd.DataFrame:
    """
    Wrapper de compatibilidad que delega en add_available_outcome_history
    para evitar el temporal leakage de labels aún no entregados.
    """
    return add_available_outcome_history(
        df=df,
        group_col=group_col,
        prefix=prefix,
        strength=strength,
    )


def add_all_temporal_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()

    # Asegurar columnas requeridas para available_history
    if "internal_order_id" not in out.columns:
        if "order_id" in out.columns:
            out["internal_order_id"] = out["order_id"]
        else:
            out["internal_order_id"] = [f"ord_{i}" for i in range(len(out))]

    if "delivered_date" not in out.columns and "order_delivered_customer_date" in out.columns:
        out["delivered_date"] = out["order_delivered_customer_date"]

    if "purchase_date" not in out.columns and "order_purchase_timestamp" in out.columns:
        out["purchase_date"] = out["order_purchase_timestamp"]

    # Asegurar route_pair
    if "route_pair" not in out.columns:
        seller_st = out["primary_seller_state"].fillna("UNK")
        cust_st = out["customer_state"].fillna("UNK")
        out["route_pair"] = seller_st + "->" + cust_st

    groups_to_compute = [
        ("primary_seller_id", "seller"),
        ("route_pair", "route"),
        ("primary_category", "category"),
        ("customer_state", "customer_state"),
        ("primary_seller_state", "seller_state"),
    ]

    for col, prefix in groups_to_compute:
        if col in out.columns:
            out = add_prior_group_stats(out, col, prefix)

    return out
