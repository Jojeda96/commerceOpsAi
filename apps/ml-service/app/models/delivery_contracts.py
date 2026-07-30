from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Dict, Any, Literal


class PredictionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scenario_id: str = Field(min_length=1)
    total_price: float = Field(gt=0)
    total_freight: float = Field(ge=0)
    estimated_delivery_days: float = Field(gt=0)
    shipping_window_days: float = Field(gt=0)
    total_weight_g: float = Field(ge=0)
    total_volume_cm3: float = Field(ge=0)
    route_distance_km: Optional[float] = Field(default=None, ge=0)
    purchase_dow: int = Field(ge=0, le=6)
    purchase_hour: int = Field(ge=0, le=23)
    purchase_month: int = Field(ge=1, le=12)
    purchase_week: int = Field(ge=1, le=53)
    item_count: int = Field(ge=1)
    seller_count: int = Field(ge=1)
    seller_prior_orders: int = Field(ge=0)
    seller_prior_late_rate_smoothed: float = Field(ge=0, le=1)
    route_prior_orders: int = Field(ge=0)
    route_prior_late_rate_smoothed: float = Field(ge=0, le=1)
    category_prior_orders: int = Field(ge=0)
    category_prior_late_rate_smoothed: float = Field(ge=0, le=1)
    primary_seller_state: str = Field(min_length=2, max_length=2)
    customer_state: str = Field(min_length=2, max_length=2)
    primary_category: str = Field(min_length=1)


class PredictionResponse(BaseModel):
    scenario_id: str
    probability: float
    predicted_delayed: bool
    threshold: float
    risk_level: str
    model_version: str
    model_name: str
    bundle_schema_version: str
    feature_contract_version: str
    prediction_status: Literal["SUCCESS"] = "SUCCESS"
    deployment_status: str
    model_reliability: str
    warning: Optional[str] = None
    features: Dict[str, Any]
    explanation: Optional[Dict[str, Any]] = None
