from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class PredictionRequest(BaseModel):
    scenario_id: str = Field(default="scenario-default")
    seller_state: str = Field(min_length=2, max_length=2)
    customer_state: str = Field(min_length=2, max_length=2)

    total_freight: float = Field(ge=0)
    total_price: float = Field(gt=0)
    total_weight_g: float = Field(ge=0)
    total_volume_cm3: float = Field(ge=0)

    item_count: int = Field(ge=1)
    seller_count: int = Field(ge=1, default=1)

    estimated_delivery_days: float = Field(gt=0, default=10.0)
    shipping_window_days: float = Field(gt=0, default=5.0)
    route_distance_km: Optional[float] = Field(default=None, ge=0)

    purchase_dow: int = Field(ge=0, le=6, default=2)
    purchase_hour: int = Field(ge=0, le=23, default=14)
    purchase_month: int = Field(ge=1, le=12, default=6)

    primary_category: Optional[str] = None
    seller_prior_orders: int = Field(ge=0, default=0)
    seller_prior_late_rate: Optional[float] = Field(default=None, ge=0, le=1)


class PredictionResponse(BaseModel):
    scenario_id: str
    probability: float
    predicted_delayed: bool
    threshold: float
    risk_level: str
    model_version: str
    deployment_status: str
    model_reliability: str
    warning: Optional[str] = None
    features: Dict[str, Any]
    explanation: Optional[Dict[str, Any]] = None
