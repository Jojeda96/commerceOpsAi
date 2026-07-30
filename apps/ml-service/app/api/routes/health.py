from fastapi import APIRouter
from app.services.ml_engine import MLEngine

router = APIRouter()

@router.get("/health")
def health_check():
    engine = MLEngine.get_instance()
    runtime = engine.get_runtime_status()

    is_ready = runtime.get("runtime_ready", False)

    return {
        "status": "healthy" if is_ready else "degraded",
        "service": "commerce-ops-ml-service",
        "version": "1.0.0",
        "runtime_ready": is_ready,
        "bundle_path": runtime.get("bundle_path"),
        "bundle_schema_version": runtime.get("bundle_schema_version"),
        "feature_contract_version": runtime.get("feature_contract_version"),
        "model_name": runtime.get("model_name"),
        "model_version": runtime.get("model_version"),
        "deployment_status": runtime.get("deployment_status"),
        "load_error": runtime.get("load_error"),
    }
