from __future__ import annotations

from typing import Any, Dict


BUNDLE_SCHEMA_VERSION = "2.1"

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

    if str(bundle["bundle_schema_version"]) != BUNDLE_SCHEMA_VERSION:
        raise RuntimeError(
            "Versión de bundle incompatible: "
            f"{bundle['bundle_schema_version']} "
            f"!= {BUNDLE_SCHEMA_VERSION}"
        )

    raw_features = bundle.get("raw_features", [])
    if not isinstance(raw_features, list) or not raw_features:
        raise RuntimeError("raw_features debe ser una lista no vacía.")

    threshold = float(bundle["threshold"])
    if not 0.0 < threshold < 1.0:
        raise RuntimeError(
            f"Threshold inválido: {threshold}"
        )
