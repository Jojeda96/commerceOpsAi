from __future__ import annotations

from typing import Any, Dict

SUPPORTED_BUNDLE_SCHEMA_VERSIONS = {"2.1", "3.0"}
SUPPORTED_MODEL_FAMILIES = {"TREE_BOOSTING", "LOGISTIC_REGRESSION", "LINEAR", "TREE"}

REQUIRED_BUNDLE_KEYS = {
    "bundle_schema_version",
    "model",
    "model_name",
    "preprocessor",
    "calibrator",
    "threshold",
    "metrics",
    "deployment_status",
    "model_version",
    "raw_features",
    "feature_names",
}


def validate_bundle(bundle: Dict[str, Any]) -> None:
    missing = REQUIRED_BUNDLE_KEYS - set(bundle)

    if missing:
        raise RuntimeError(
            f"Bundle ML incompleto. Faltan: {sorted(missing)}"
        )

    schema_ver = str(bundle["bundle_schema_version"])
    if schema_ver not in SUPPORTED_BUNDLE_SCHEMA_VERSIONS:
        raise RuntimeError(
            f"Versión de bundle incompatible: {schema_ver}. Soportadas: {SUPPORTED_BUNDLE_SCHEMA_VERSIONS}"
        )

    raw_features = bundle.get("raw_features", [])
    if not isinstance(raw_features, list) or not raw_features:
        raise RuntimeError("raw_features debe ser una lista no vacía.")

    model_family = bundle.get("model_family")
    if model_family and model_family not in SUPPORTED_MODEL_FAMILIES:
        raise RuntimeError(
            f"Familia de modelo desconocida: {model_family}. Soportadas: {SUPPORTED_MODEL_FAMILIES}"
        )

    threshold = float(bundle["threshold"])
    if not 0.0 <= threshold <= 1.0:
        raise RuntimeError(
            f"Threshold inválido: {threshold}"
        )
