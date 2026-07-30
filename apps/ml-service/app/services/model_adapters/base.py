from typing import Protocol, Dict, Any, List
import numpy as np

class ModelAdapter(Protocol):
    model_type: str
    model_family: str

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        ...

    def explain(self, X: np.ndarray, feature_names: List[str], preprocessor: Any = None) -> Dict[str, Any]:
        ...
