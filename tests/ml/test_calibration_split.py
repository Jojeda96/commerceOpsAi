import pytest
import numpy as np
from scripts.ml.calibration_evaluation import evaluate_calibration_split

def test_evaluate_calibration_split_computes_brier_improvement():
    y_true = np.array([0, 1, 0, 1, 0])
    uncal = np.array([0.5, 0.5, 0.5, 0.5, 0.5])
    cal = np.array([0.1, 0.9, 0.1, 0.9, 0.1])

    res = evaluate_calibration_split(y_true, uncal, cal)
    assert res["uncalibrated"]["brier_score"] > res["calibrated"]["brier_score"]
    assert res["brier_improvement_pct"] > 0
