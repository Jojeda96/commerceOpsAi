from typing import Dict, Any, List
import numpy as np

class TreeModelAdapter:
    model_type = "tree"
    model_family = "TREE_BOOSTING"

    def __init__(self, model: Any):
        self.model = model
        try:
            import shap
            self.explainer = shap.TreeExplainer(model)
        except Exception:
            self.explainer = None

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return self.model.predict_proba(X)

    def explain(self, X: np.ndarray, feature_names: List[str], preprocessor: Any = None) -> Dict[str, Any]:
        contributions = []
        base_value = 0.15
        if self.explainer is not None:
            try:
                shap_vals = self.explainer.shap_values(X)[0]
                expected = getattr(self.explainer, "expected_value", 0.15)
                if isinstance(expected, (list, np.ndarray)):
                    base_value = float(expected[0])
                else:
                    base_value = float(expected)

                for feat, val in zip(feature_names, shap_vals):
                    contributions.append({
                        "feature": feat,
                        "raw_margin_contribution": round(float(val), 6),
                        "direction": "INCREASES_MODEL_SCORE" if val > 0 else "DECREASES_MODEL_SCORE",
                    })
                contributions = sorted(contributions, key=lambda x: abs(x["raw_margin_contribution"]), reverse=True)[:10]
            except Exception:
                pass

        return {
            "explanation_method": "SHAP_TREE",
            "explanation_scale": "RAW_MARGIN",
            "causal_interpretation": False,
            "base_value": round(base_value, 4),
            "contributions": contributions,
        }
