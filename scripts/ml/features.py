import numpy as np
import pandas as pd


def haversine_km(lat1, lon1, lat2, lon2):
    radius = 6371.0088

    lat1_rad = np.radians(lat1)
    lon1_rad = np.radians(lon1)
    lat2_rad = np.radians(lat2)
    lon2_rad = np.radians(lon2)

    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad

    a = (
        np.sin(dlat / 2.0) ** 2
        + np.cos(lat1_rad)
        * np.cos(lat2_rad)
        * np.sin(dlon / 2.0) ** 2
    )

    return 2.0 * radius * np.arcsin(np.sqrt(np.clip(a, 0.0, 1.0)))


def add_direct_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()

    # Fechas
    out["purchase_date"] = pd.to_datetime(out["purchase_date"])
    out["estimated_date"] = pd.to_datetime(out["estimated_date"])
    if "first_shipping_limit" in out.columns:
        out["first_shipping_limit"] = pd.to_datetime(out["first_shipping_limit"])
    if "last_shipping_limit" in out.columns:
        out["last_shipping_limit"] = pd.to_datetime(out["last_shipping_limit"])

    seller_st = out["primary_seller_state"].fillna("UNK")
    cust_st = out["customer_state"].fillna("UNK")
    out["is_interstate"] = (seller_st != cust_st).astype("int8")
    out["route_pair"] = seller_st + "->" + cust_st

    total_price = out["total_price"].fillna(0.0)
    total_freight = out["total_freight"].fillna(0.0)
    out["freight_ratio"] = total_freight / (total_price + total_freight + 1e-6)

    out["estimated_delivery_days"] = (
        (out["estimated_date"] - out["purchase_date"]).dt.total_seconds() / 86_400.0
    )

    if "last_shipping_limit" in out.columns:
        out["shipping_window_days"] = (
            (out["last_shipping_limit"] - out["purchase_date"]).dt.total_seconds() / 86_400.0
        )
    else:
        out["shipping_window_days"] = out["estimated_delivery_days"]

    out["purchase_dow"] = out["purchase_date"].dt.dayofweek
    out["purchase_hour"] = out["purchase_date"].dt.hour
    out["purchase_month"] = out["purchase_date"].dt.month
    out["purchase_week"] = (
        out["purchase_date"].dt.isocalendar().week.astype(int)
    )

    item_count = out["item_count"].clip(lower=1)
    out["avg_item_price"] = total_price / item_count
    out["avg_item_weight_g"] = out["total_weight_g"].fillna(0.0) / item_count
    out["avg_item_volume_cm3"] = out["total_volume_cm3"].fillna(0.0) / item_count

    # Distancia geográfica
    if "primary_seller_lat" in out.columns and "customer_lat" in out.columns:
        out["route_distance_km"] = haversine_km(
            out["primary_seller_lat"],
            out["primary_seller_lng"],
            out["customer_lat"],
            out["customer_lng"],
        )
        out["route_distance_missing"] = out["route_distance_km"].isna().astype("int8")
    else:
        out["route_distance_km"] = np.nan
        out["route_distance_missing"] = 1

    return out
