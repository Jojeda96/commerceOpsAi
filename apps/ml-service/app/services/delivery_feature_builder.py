import pandas as pd
from typing import List
from app.models.delivery_contracts import PredictionRequest

class FeatureContractError(ValueError):
    """Raised when feature contract requirements or parity checks fail."""
    pass

def build_delivery_feature_row(request: PredictionRequest, raw_features: List[str]) -> pd.DataFrame:
    """
    Constructs a 1-row DataFrame containing features in the exact order specified by raw_features.
    Calculates deterministic derived features without runtime defaults or fallback values.
    """
    freight_ratio = request.total_freight / request.total_price if request.total_price > 0 else 0.0
    avg_item_price = request.total_price / request.item_count
    avg_item_weight_g = request.total_weight_g / request.item_count
    avg_item_volume_cm3 = request.total_volume_cm3 / request.item_count
    route_pair = f"{request.primary_seller_state}_{request.customer_state}"
    is_interstate = 1 if request.primary_seller_state != request.customer_state else 0

    feature_dict = {
        "total_price": request.total_price,
        "total_freight": request.total_freight,
        "freight_ratio": freight_ratio,
        "estimated_delivery_days": request.estimated_delivery_days,
        "shipping_window_days": request.shipping_window_days,
        "avg_item_price": avg_item_price,
        "avg_item_weight_g": avg_item_weight_g,
        "avg_item_volume_cm3": avg_item_volume_cm3,
        "route_distance_km": request.route_distance_km,
        "purchase_dow": request.purchase_dow,
        "purchase_hour": request.purchase_hour,
        "purchase_month": request.purchase_month,
        "purchase_week": request.purchase_week,
        "item_count": request.item_count,
        "seller_count": request.seller_count,
        "seller_prior_orders": request.seller_prior_orders,
        "seller_prior_late_rate_smoothed": request.seller_prior_late_rate_smoothed,
        "route_prior_orders": request.route_prior_orders,
        "route_prior_late_rate_smoothed": request.route_prior_late_rate_smoothed,
        "category_prior_orders": request.category_prior_orders,
        "category_prior_late_rate_smoothed": request.category_prior_late_rate_smoothed,
        "primary_seller_state": request.primary_seller_state,
        "customer_state": request.customer_state,
        "route_pair": route_pair,
        "primary_category": request.primary_category,
        "is_interstate": is_interstate,
    }

    # Verify all expected raw_features exist
    missing_features = [f for f in raw_features if f not in feature_dict]
    if missing_features:
        raise FeatureContractError(f"Missing required features for contract: {missing_features}")

    extra_features = [f for f in feature_dict if f not in raw_features]
    if extra_features:
        raise FeatureContractError(f"Unexpected extra features generated: {extra_features}")

    df = pd.DataFrame([feature_dict])[raw_features]
    return df
