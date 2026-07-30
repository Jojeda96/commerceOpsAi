import sys
import os
import numpy as np
from sklearn.metrics import precision_recall_curve, f1_score

# Ensure apps/ml-service is in sys.path if imported from scripts
ml_service_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "apps", "ml-service"))
if ml_service_dir not in sys.path:
    sys.path.insert(0, ml_service_dir)

from app.services.calibration import PlattCalibrator


def select_threshold_for_best_f1(y_true, probabilities):
    precisions, recalls, thresholds = precision_recall_curve(y_true, probabilities)
    f1_scores = 2 * (precisions * recalls) / np.maximum(precisions + recalls, 1e-6)
    best_idx = np.argmax(f1_scores)
    
    if best_idx < len(thresholds):
        best_threshold = float(thresholds[best_idx])
    else:
        best_threshold = 0.5

    return max(0.05, min(0.95, best_threshold))


def select_threshold_for_min_precision(
    y_true,
    probabilities,
    min_precision=0.15,
):
    precisions, recalls, thresholds = precision_recall_curve(y_true, probabilities)
    candidates = []

    for idx, threshold in enumerate(thresholds):
        if precisions[idx] >= min_precision:
            candidates.append((recalls[idx], precisions[idx], threshold))

    if not candidates:
        # Fallback a best F1 si no hay ninguno que cumpla la precision mínima
        return select_threshold_for_best_f1(y_true, probabilities)

    best_candidate = max(candidates) # Maximiza recall entre los que tienen precision >= min_precision
    return float(best_candidate[2])
