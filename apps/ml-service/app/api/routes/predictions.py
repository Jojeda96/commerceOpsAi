from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.services.ml_engine import MLEngine

router = APIRouter(prefix="/models/delivery-delay", tags=["Predictions"])

class PredictionRequest(BaseModel):
    seller_state: str = "SP"
    customer_state: str = "RJ"
    freight_value: float = 30.0
    item_count: int = 1
    product_weight_g: float = 500.0
    product_volume_cm3: float = 4500.0
    price: float = 100.0
    purchase_dow: int = 2
    purchase_hour: int = 14

class PredictionResponse(BaseModel):
    probability: float
    risk_level: str
    model_version: str
    features: Dict[str, Any]
    explanation: Optional[Dict[str, Any]] = None

@router.post("/predict", response_model=PredictionResponse)
async def predict_delay(request: PredictionRequest):
    engine = MLEngine.get_instance()
    res = engine.predict_delay(request.model_dump())
    return PredictionResponse(
        probability=res["probability"],
        risk_level=res["risk_level"],
        model_version=res["model_version"],
        features=res["features"],
        explanation=res.get("explanation"),
    )

@router.post("/explain")
async def explain_prediction(request: PredictionRequest):
    engine = MLEngine.get_instance()
    res = engine.predict_delay(request.model_dump())
    return res.get("explanation", {})

@router.get("/metrics")
async def get_metrics():
    engine = MLEngine.get_instance()
    return engine.get_metrics()
