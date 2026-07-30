import os
import json
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, Optional

from app.models.delivery_contracts import PredictionRequest
from app.services.delivery_feature_builder import build_delivery_feature_row, FeatureContractError
from app.services.model_bundle import validate_bundle
from app.services.model_governance import evaluate_delivery_model, ModelGateResult
from app.services.model_adapters.factory import get_model_adapter


class ModelNotApprovedError(RuntimeError):
    pass


class ModelUnavailableError(RuntimeError):
    pass


class ModelBundleLoadError(RuntimeError):
    pass


class MLEngine:
    _instance: Optional["MLEngine"] = None

    def __init__(self):
        curr = os.path.abspath(__file__)
        while curr and not os.path.exists(os.path.join(curr, "data")):
            parent = os.path.dirname(curr)
            if parent == curr:
                break
            curr = parent
        self.root_dir = curr if os.path.exists(os.path.join(curr, "data")) else os.getcwd()
        self.models_dir = os.path.join(self.root_dir, "data", "models")
        
        self.bundle_path = os.getenv(
            "DELIVERY_MODEL_BUNDLE_PATH",
            os.path.join(self.models_dir, "delivery_delay_champion.joblib"),
        )
        self.metrics_path = os.path.join(self.models_dir, "delivery_delay_metrics.json")
        
        self.bundle: Dict[str, Any] = {}
        self.model = None
        self.adapter = None
        self.preprocessor = None
        self.calibrator = None
        self.metrics: Dict[str, Any] = {}
        self.threshold: float = 0.5
        self.load_error: Optional[str] = None
        self.model_name: Optional[str] = None

        self.load_bundle()

    @classmethod
    def get_instance(cls) -> "MLEngine":
        if cls._instance is None:
            cls._instance = MLEngine()
        return cls._instance

    def load_bundle(self):
        import sys
        if self.root_dir not in sys.path:
            sys.path.insert(0, self.root_dir)

        if not os.path.exists(self.bundle_path):
            self.load_error = "MODEL_BUNDLE_NOT_FOUND"
            return

        try:
            loaded = joblib.load(self.bundle_path)

            if not isinstance(loaded, dict):
                raise ModelBundleLoadError("El artefacto cargado no es un diccionario bundle.")

            validate_bundle(loaded)

            self.bundle = loaded
            self.model = loaded["model"]
            self.adapter = get_model_adapter(self.model, loaded.get("model_family"))
            self.preprocessor = loaded["preprocessor"]
            self.calibrator = loaded.get("calibrator")
            self.threshold = float(loaded["threshold"])
            self.metrics = loaded.get("metrics", {})
            self.model_name = loaded.get("model_name", "xgboost_baseline")
            self.load_error = None
            print(f"[MLEngine] [OK] Bundle cargado desde: {self.bundle_path} con adapter: {self.adapter.__class__.__name__}")

        except Exception as exc:
            self.bundle = {}
            self.model = None
            self.adapter = None
            self.preprocessor = None
            self.calibrator = None
            self.load_error = f"{type(exc).__name__}: {exc}"
            print(f"[MLEngine] [WARNING] Error al cargar bundle ML: {self.load_error}")

        if not self.metrics and os.path.exists(self.metrics_path):
            try:
                with open(self.metrics_path, "r", encoding="utf-8") as f:
                    self.metrics = json.load(f)
            except Exception:
                pass

    def get_runtime_status(self) -> dict:
        return {
            "runtime_ready": (
                self.model is not None
                and self.preprocessor is not None
            ),
            "bundle_path": self.bundle_path,
            "bundle_schema_version": self.bundle.get("bundle_schema_version", "3.0"),
            "feature_contract_version": self.bundle.get("feature_contract_version", "delivery-features-v3.0.0"),
            "model_name": self.bundle.get("model_name", "xgboost_baseline"),
            "model_version": self.bundle.get("model_version", "delivery-risk-v3.0.0"),
            "deployment_status": self.bundle.get("deployment_status", "UNAVAILABLE"),
            "load_error": self.load_error,
        }

    def _assert_model_is_approved(self, allow_experimental: bool = False) -> ModelGateResult:
        gate = evaluate_delivery_model(self.metrics)
        if not gate.approved and not allow_experimental:
            raise ModelNotApprovedError(
                "El modelo no está aprobado para inferencia operativa: " + ", ".join(gate.reasons)
            )
        return gate

    def predict_delay(self, request: PredictionRequest, allow_experimental: bool = False) -> Dict[str, Any]:
        if self.model is None or self.preprocessor is None:
            raise ModelUnavailableError(
                self.load_error or "MODEL_RUNTIME_UNAVAILABLE"
            )

        gate = self._assert_model_is_approved(allow_experimental=allow_experimental)

        raw_features = self.bundle.get("raw_features", [])
        if not raw_features:
            raise FeatureContractError("Bundle raw_features non-existent or empty.")

        input_df = build_delivery_feature_row(request, raw_features)

        warning_msg = None if gate.approved else f"⚠ Modelo experimental no aprobado ({', '.join(gate.reasons)}) — no utilizar para decisiones operativas."

        X_trans = self.preprocessor.transform(input_df)
        
        adapter = self.adapter or get_model_adapter(self.model, self.bundle.get("model_family"))
        raw_prob = float(adapter.predict_proba(X_trans)[0][1])

        if self.calibrator is not None:
            prob = float(self.calibrator.predict(np.array([raw_prob]))[0])
        else:
            prob = raw_prob

        prob = round(prob, 6)

        opt_thresh = self.threshold
        is_delayed = prob >= opt_thresh

        if prob >= opt_thresh:
            risk_level = "HIGH"
        elif prob >= 0.5 * opt_thresh:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        feature_names = self.bundle.get("feature_names", [f"f_{i}" for i in range(X_trans.shape[1])])
        explanation = adapter.explain(X_trans, feature_names=feature_names, preprocessor=self.preprocessor)

        return {
            "scenario_id": request.scenario_id,
            "probability": prob,
            "threshold": round(opt_thresh, 4),
            "predicted_delayed": is_delayed,
            "risk_level": risk_level,
            "model_version": self.bundle.get("model_version", "delivery-risk-v3.0.0"),
            "model_name": self.bundle.get("model_name", "xgboost_baseline"),
            "bundle_schema_version": self.bundle.get("bundle_schema_version", "3.0"),
            "feature_contract_version": self.bundle.get("feature_contract_version", "delivery-features-v3.0.0"),
            "prediction_status": "SUCCESS",
            "deployment_status": gate.status,
            "model_reliability": "EXPERIMENTAL_NOT_APPROVED" if not gate.approved else "APPROVED_FOR_DEMO",
            "warning": warning_msg,
            "features": request.model_dump(),
            "explanation": explanation
        }

    def get_metrics(self) -> Dict[str, Any]:
        if self.metrics:
            gate = evaluate_delivery_model(self.metrics)
            out = dict(self.metrics)
            out["deployment_status"] = gate.status
            out["deployment_reasons"] = gate.reasons
            return out

        return {
            "status": "MODEL_NOT_TRAINED",
            "deployment_status": "UNAVAILABLE",
            "model_version": None,
            "metrics": None,
            "message": "No existe un artefacto de métricas válido. Ejecute scripts/train_delivery_champion.py.",
        }
