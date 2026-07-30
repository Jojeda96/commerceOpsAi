from typing import Dict, Any, List
import numpy as np

class LinearModelAdapter:
    model_type = "linear"
    model_family = "LOGISTIC_REGRESSION"

    def __init__(self, model: Any):
        self.model = model

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return self.model.predict_proba(X)

    def explain(self, X: np.ndarray, feature_names: List[str], preprocessor: Any = None) -> Dict[str, Any]:
        contributions = []
        intercept = float(getattr(self.model, "intercept_", [0.0])[0])
        coefs = getattr(self.model, "coef_", [[]])[0]

        x_row = X[0] if len(X.shape) > 1 else X
        for i, feat in enumerate(feature_names):
            if i < len(coefs) and i < len(x_row):
                val = float(x_row[i] * coefs[i])
                contributions.append({
                    "feature": feat,
                    "raw_margin_contribution": round(val, 6),
                    "direction": "INCREASES_MODEL_SCORE" if val > 0 else "DECREASES_MODEL_SCORE",
                })

        contributions = sorted(contributions, key=lambda x: abs(x["raw_margin_contribution"]), reverse=True)[:10]

        return {
            "explanation_method": "LINEAR_LOG_ODDS_CONTRIBUTION",
            "explanation_scale": "LOG_ODDS",
            "causal_interpretation": False,
            "base_value": round(intercept, 4),
            "contributions": contributions,
        }
