"""
Feature snapshot schema validator for point-in-time features.
"""

from typing import Dict, Any, List

REQUIRED_SNAPSHOT_FIELDS = [
    "order_id",
    "feature_contract_version",
    "prediction_moment",
    "purchase_date",
    "primary_seller_state",
    "customer_state",
    "primary_category",
    "total_price",
    "total_freight",
    "total_weight_g",
    "total_volume_cm3",
    "item_count",
    "seller_count",
    "estimated_delivery_days",
    "shipping_window_days",
    "purchase_dow",
    "purchase_hour",
    "purchase_month",
    "purchase_week",
    "seller_prior_orders",
    "seller_prior_late_rate_smoothed",
    "route_prior_orders",
    "route_prior_late_rate_smoothed",
    "category_prior_orders",
    "category_prior_late_rate_smoothed",
    "is_delayed",
]

def validate_snapshot_dict(snapshot: Dict[str, Any]) -> List[str]:
    """Returns list of missing field names or validation errors."""
    errors = []
    for field in REQUIRED_SNAPSHOT_FIELDS:
        if field not in snapshot or snapshot[field] is None:
            errors.append(f"Missing required field: {field}")

    if snapshot.get("prediction_moment") != "ORDER_PURCHASE":
        errors.append("prediction_moment must be ORDER_PURCHASE")

    if snapshot.get("feature_contract_version") != "delivery-features-v3.0.0":
        errors.append("feature_contract_version must be delivery-features-v3.0.0")

    return errors
