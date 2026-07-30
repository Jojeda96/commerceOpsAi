import numpy as np
from scipy.special import logit
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_recall_curve, f1_score


class PlattCalibrator:
    def __init__(self):
        self.model = LogisticRegression()

    def fit(self, probabilities, labels):
        clipped = np.clip(probabilities, 1e-6, 1.0 - 1e-6)
        logits = logit(clipped).reshape(-1, 1)
        self.model.fit(logits, labels)
        return self

    def predict(self, probabilities):
        clipped = np.clip(probabilities, 1e-6, 1.0 - 1e-6)
        logits = logit(clipped).reshape(-1, 1)
        return self.model.predict_proba(logits)[:, 1]


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
