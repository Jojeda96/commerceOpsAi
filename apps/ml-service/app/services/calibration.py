from __future__ import annotations

import numpy as np
from scipy.special import logit
from sklearn.linear_model import LogisticRegression


class PlattCalibrator:
    """Calibrador serializable disponible tanto en training como serving."""

    def __init__(self) -> None:
        self.model = LogisticRegression(
            max_iter=2_000,
            random_state=42,
        )

    def fit(
        self,
        probabilities: np.ndarray,
        labels: np.ndarray,
    ) -> "PlattCalibrator":
        clipped = np.clip(
            np.asarray(probabilities, dtype=float),
            1e-6,
            1.0 - 1e-6,
        )
        logits = logit(clipped).reshape(-1, 1)
        self.model.fit(logits, labels)
        return self

    def predict(
        self,
        probabilities: np.ndarray,
    ) -> np.ndarray:
        clipped = np.clip(
            np.asarray(probabilities, dtype=float),
            1e-6,
            1.0 - 1e-6,
        )
        logits = logit(clipped).reshape(-1, 1)
        return self.model.predict_proba(logits)[:, 1]
