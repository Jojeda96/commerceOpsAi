from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

router = APIRouter(prefix="/models/delivery-delay", tags=["Predictions"])

class PredictionRequest(BaseModel):
    seller_state: str = "SP"
    customer_state: str = "RJ"
    freight_value: float = 30.0
    item_count: int = 1
    product_weight_g: float = 500.0
    price: float = 100.0
    distance_category: int = 1

class PredictionResponse(BaseModel):
    probability: float
    risk_level: str
    model_version: str
    features: Dict[str, Any]
    explanation: Optional[Dict[str, Any]] = None

@router.post("/predict", response_model=PredictionResponse)
async def predict_delay(request: PredictionRequest):
    # Lógica con fallback si el artefacto no existe en disco
    probability = 0.15
    is_interstate = request.seller_state != request.customer_state
    if is_interstate:
        probability += 0.25
    if request.freight_value > 50:
        probability += 0.15
    if request.item_count > 2:
        probability += 0.10

    probability = min(0.95, round(probability, 2))

    return PredictionResponse(
        probability=probability,
        risk_level="HIGH" if probability > 0.5 else "MEDIUM" if probability > 0.3 else "LOW",
        model_version="delivery-delay-heuristic-v1",
        features={
            "seller_state": request.seller_state,
            "customer_state": request.customer_state,
            "is_interstate": is_interstate,
            "freight_value": request.freight_value,
            "item_count": request.item_count,
        },
        explanation={
            "base_value": 0.15,
            "explanation_type": "heuristic_contributions",
            "contributions": [
                {"feature": "is_interstate", "weight": 0.25 if is_interstate else 0.0},
                {"feature": "freight_value_above_50", "weight": 0.15 if request.freight_value > 50 else 0.0},
                {"feature": "item_count_above_2", "weight": 0.10 if request.item_count > 2 else 0.0},
            ]
        }
    )

@router.post("/explain")
async def explain_prediction(request: PredictionRequest):
    is_interstate = request.seller_state != request.customer_state
    return {
        "model_version": "delivery-delay-heuristic-v1",
        "algorithm": "deterministic_rules",
        "explanation_type": "heuristic_contributions",
        "base_value": 0.15,
        "contributions": [
            {"feature": "interstate_route", "heuristic_weight": 0.25 if is_interstate else 0.0},
            {"feature": "freight_value", "heuristic_weight": 0.15 if request.freight_value > 50 else 0.02},
            {"feature": "item_count", "heuristic_weight": 0.10 if request.item_count > 2 else 0.01},
        ]
    }

@router.get("/metrics")
async def get_metrics():
    return {
        "model_version": "delivery-delay-heuristic-v1",
        "algorithm": "Deterministic Rule-Based Baseline",
        "note": "Baseline heurístico determinista. Entrenamiento de modelo predictivo XGBoost en roadmap.",
        "features": [
            "seller_state",
            "customer_state",
            "freight_value",
            "item_count",
            "product_weight_g",
            "price"
        ]
    }
