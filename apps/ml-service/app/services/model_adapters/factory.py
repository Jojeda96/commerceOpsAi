from typing import Any
from app.services.model_adapters.tree import TreeModelAdapter
from app.services.model_adapters.linear import LinearModelAdapter

def get_model_adapter(model: Any, model_family: str = None):
    family = (model_family or "").upper()
    if family == "LOGISTIC_REGRESSION" or "logistic" in type(model).__name__.lower():
        return LinearModelAdapter(model)
    elif family in ["TREE_BOOSTING", "XGBOOST", "RANDOM_FOREST"] or "xgb" in type(model).__name__.lower() or "tree" in type(model).__name__.lower():
        return TreeModelAdapter(model)
    else:
        if hasattr(model, "coef_"):
            return LinearModelAdapter(model)
        return TreeModelAdapter(model)
