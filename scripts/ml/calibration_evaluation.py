"""
Calibration Evaluation Report Generator
"""

from typing import Dict, Any
import numpy as np
from sklearn.metrics import brier_score_loss, log_loss

def evaluate_calibration_split(y_true: np.ndarray, uncalibrated_probs: np.ndarray, calibrated_probs: np.ndarray) -> Dict[str, Any]:
    uncal_brier = float(brier_score_loss(y_true, uncalibrated_probs))
    cal_brier = float(brier_score_loss(y_true, calibrated_probs))

    uncal_loss = float(log_loss(y_true, uncalibrated_probs))
    cal_loss = float(log_loss(y_true, calibrated_probs))

    return {
        "schema_version": "3.0",
        "uncalibrated": {
            "brier_score": round(uncal_brier, 4),
            "log_loss": round(uncal_loss, 4),
        },
        "calibrated": {
            "brier_score": round(cal_brier, 4),
            "log_loss": round(cal_loss, 4),
        },
        "brier_improvement_pct": round(float((uncal_brier - cal_brier) / max(uncal_brier, 1e-6) * 100), 2),
    }
