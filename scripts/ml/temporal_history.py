import numpy as np
import pandas as pd


def add_prior_group_stats(
    df: pd.DataFrame,
    group_col: str,
    prefix: str,
    strength: float = 20.0,
) -> pd.DataFrame:
    """
    Calcula estadísticas históricas acumuladas estrictamente anteriores al pedido actual
    para evitar el temporal leakage del target.
    """
    out = df.sort_values("purchase_date").copy()
    
    # Manejo de nulos en la columna de agrupación
    group_series = out[group_col].fillna("UNK")
    grouped = out.assign(_group_temp=group_series).groupby("_group_temp", sort=False)["is_delayed"]

    prior_orders = grouped.cumcount()
    out[f"{prefix}_prior_orders"] = prior_orders
    
    prior_late_sum = grouped.cumsum() - out["is_delayed"]

    out[f"{prefix}_prior_late_rate"] = np.where(
        prior_orders > 0,
        prior_late_sum / np.maximum(prior_orders, 1),
        np.nan,
    )

    # Suavizado Bayesiano con tasa global previa
    global_prior = out["is_delayed"].expanding().mean().shift(1).fillna(0.08)

    out[f"{prefix}_prior_late_rate_smoothed"] = (
        prior_late_sum + strength * global_prior
    ) / (prior_orders + strength)

    if "_group_temp" in out.columns:
        out.drop(columns=["_group_temp"], inplace=True)

    return out


def add_all_temporal_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()

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
