from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Any
from app.services.ml_engine import MLEngine, ModelNotApprovedError, ModelUnavailableError
from app.models.delivery_contracts import PredictionRequest, PredictionResponse

router = APIRouter(prefix="/models/delivery-delay", tags=["Predictions"])


@router.get("/runtime")
async def get_runtime():
    return MLEngine.get_instance().get_runtime_status()


@router.post("/predict", response_model=PredictionResponse)
async def predict_delay(
    request: PredictionRequest,
    allow_experimental: bool = Query(default=False),
):
    engine = MLEngine.get_instance()
    try:
        res = engine.predict_delay(request.model_dump(), allow_experimental=allow_experimental)
        return PredictionResponse(
            scenario_id=res["scenario_id"],
            probability=res["probability"],
            predicted_delayed=res["predicted_delayed"],
            threshold=res["threshold"],
            risk_level=res["risk_level"],
            model_version=res["model_version"],
            deployment_status=res.get("deployment_status", "UNAVAILABLE"),
            model_reliability=res.get("model_reliability", "LOW"),
            warning=res.get("warning"),
            features=res["features"],
            explanation=res.get("explanation"),
        )
    except ModelUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "MODEL_RUNTIME_UNAVAILABLE",
                "message": str(exc),
            },
        ) from exc
    except ModelNotApprovedError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "MODEL_NOT_APPROVED",
                "message": str(exc),
                "metrics_url": "/models/delivery-delay/metrics",
            },
        ) from exc


@router.post("/explain")
async def explain_prediction(
    request: PredictionRequest,
    allow_experimental: bool = Query(default=False),
):
    engine = MLEngine.get_instance()
    try:
        res = engine.predict_delay(request.model_dump(), allow_experimental=allow_experimental)
        return res.get("explanation", {})
    except ModelUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "MODEL_RUNTIME_UNAVAILABLE",
                "message": str(exc),
            },
        ) from exc
    except ModelNotApprovedError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "MODEL_NOT_APPROVED",
                "message": str(exc),
                "metrics_url": "/models/delivery-delay/metrics",
            },
        ) from exc


@router.get("/metrics")
async def get_metrics():
    engine = MLEngine.get_instance()
    return engine.get_metrics()
