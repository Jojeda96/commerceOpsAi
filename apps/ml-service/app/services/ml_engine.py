import os
import json
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, Optional

from app.services.model_bundle import validate_bundle
from app.services.model_governance import evaluate_delivery_model, ModelGateResult


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
        self.bundle_path = os.path.join(self.models_dir, "delivery_delay_xgb.joblib")
        self.metrics_path = os.path.join(self.models_dir, "delivery_delay_metrics.json")
        
        self.bundle: Dict[str, Any] = {}
        self.model = None
        self.preprocessor = None
        self.calibrator = None
        self.metrics: Dict[str, Any] = {}
        self.threshold: float = 0.5
        self.explainer = None
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
            self.preprocessor = loaded["preprocessor"]
            self.calibrator = loaded.get("calibrator")
            self.threshold = float(loaded["threshold"])
            self.metrics = loaded.get("metrics", {})
            self.model_name = loaded.get("model_name", "xgboost")
            self.load_error = None
            print(f"[MLEngine] [OK] Bundle v2.1 cargado desde: {self.bundle_path}")

            try:
                import shap
                self.explainer = shap.TreeExplainer(self.model)
            except Exception as e:
                print(f"[MLEngine] SHAP Explainer no inicializado: {e}")
        except Exception as exc:
            self.bundle = {}
            self.model = None
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
            "bundle_schema_version": self.bundle.get("bundle_schema_version"),
            "model_name": self.bundle.get("model_name"),
            "model_version": self.bundle.get("model_version"),
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

    def predict_delay(self, request_dict: Dict[str, Any], allow_experimental: bool = False) -> Dict[str, Any]:
        if self.model is None or self.preprocessor is None:
            raise ModelUnavailableError(
                self.load_error or "MODEL_RUNTIME_UNAVAILABLE"
            )

        gate = self._assert_model_is_approved(allow_experimental=allow_experimental)

        scenario_id = str(request_dict.get("scenario_id", "scenario-default"))
        seller_st = str(request_dict.get("seller_state", "SP"))
        cust_st = str(request_dict.get("customer_state", "RJ"))
        route_pair = f"{seller_st}->{cust_st}"

        freight_value = float(request_dict.get("total_freight", request_dict.get("freight_value", 30.0)))
        price = float(request_dict.get("total_price", request_dict.get("price", 100.0)))
        freight_ratio = freight_value / (price + freight_value + 1e-6)
        item_count = int(request_dict.get("item_count", 1))
        weight_g = float(request_dict.get("total_weight_g", request_dict.get("product_weight_g", 500.0)))
        volume_cm3 = float(request_dict.get("total_volume_cm3", request_dict.get("product_volume_cm3", 4500.0)))
        est_days = float(request_dict.get("estimated_delivery_days", 10.0))
        ship_days = float(request_dict.get("shipping_window_days", est_days))

        route_dist = request_dict.get("route_distance_km")
        route_dist_val = float(route_dist) if route_dist is not None else np.nan

        row_dict = {
            "total_price": price,
            "total_freight": freight_value,
            "freight_ratio": freight_ratio,
            "estimated_delivery_days": est_days,
            "shipping_window_days": ship_days,
            "avg_item_price": price / max(item_count, 1),
            "avg_item_weight_g": weight_g / max(item_count, 1),
            "avg_item_volume_cm3": volume_cm3 / max(item_count, 1),
            "route_distance_km": route_dist_val,
            "purchase_dow": int(request_dict.get("purchase_dow", 2)),
            "purchase_hour": int(request_dict.get("purchase_hour", 14)),
            "purchase_month": int(request_dict.get("purchase_month", 6)),
            "purchase_week": int(request_dict.get("purchase_week", 24)),
            "item_count": item_count,
            "seller_count": int(request_dict.get("seller_count", 1)),
            "seller_prior_orders": int(request_dict.get("seller_prior_orders", 0)),
            "seller_prior_late_rate_smoothed": float(request_dict.get("seller_prior_late_rate", 0.08) or 0.08),
            "route_prior_orders": 0,
            "route_prior_late_rate_smoothed": 0.08,
            "category_prior_orders": 0,
            "category_prior_late_rate_smoothed": 0.08,
            "primary_seller_state": seller_st,
            "customer_state": cust_st,
            "route_pair": route_pair,
            "primary_category": request_dict.get("primary_category", "beleza_saude"),
            "is_interstate": 1 if seller_st != cust_st else 0,
        }

        input_df = pd.DataFrame([row_dict])
        warning_msg = None if gate.approved else f"⚠ Modelo experimental no aprobado ({', '.join(gate.reasons)}) — no utilizar para decisiones operativas."

        X_trans = self.preprocessor.transform(input_df)
        raw_prob = float(self.model.predict_proba(X_trans)[0][1])

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

        contributions = []
        if self.explainer is not None:
            shap_vals = self.explainer.shap_values(X_trans)[0]
            feature_names = self.bundle.get("feature_names", [f"f_{i}" for i in range(len(shap_vals))])
            for feat, val in zip(feature_names, shap_vals):
                contributions.append({
                    "feature": feat,
                    "raw_margin_contribution": round(float(val), 6),
                    "direction": "INCREASES_MODEL_SCORE" if val > 0 else "DECREASES_MODEL_SCORE",
                })

            contributions = sorted(contributions, key=lambda x: abs(x["raw_margin_contribution"]), reverse=True)[:10]

        return {
            "scenario_id": scenario_id,
            "probability": prob,
            "threshold": round(opt_thresh, 4),
            "predicted_delayed": is_delayed,
            "risk_level": risk_level,
            "model_version": self.bundle.get("model_version", "delivery-risk-v2.0.0"),
            "deployment_status": gate.status,
            "model_reliability": "EXPERIMENTAL_NOT_APPROVED" if not gate.approved else "APPROVED_FOR_DEMO",
            "warning": warning_msg,
            "features": request_dict,
            "explanation": {
                "explanation_scale": "XGBOOST_RAW_MARGIN",
                "causal_interpretation": False,
                "base_value": round(float(getattr(self.explainer, "expected_value", 0.15)), 4) if self.explainer else 0.15,
                "contributions": contributions,
            }
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
            "message": "No existe un artefacto de métricas válido. Ejecute scripts/train_delivery_xgb.py.",
        }
