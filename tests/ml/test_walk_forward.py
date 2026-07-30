import pytest
import pandas as pd
import numpy as np
from scripts.ml.walk_forward import run_walk_forward_cv

def test_walk_forward_cv_returns_n_folds_and_summary():
    df = pd.DataFrame({
        "purchase_date": pd.date_range("2017-01-01", periods=1000, freq="h"),
        "is_delayed": np.random.choice([0, 1], size=1000, p=[0.9, 0.1])
    })
    res = run_walk_forward_cv(df, n_folds=4)
    assert res["n_folds"] == 4
    assert len(res["folds"]) == 4
    assert "summary" in res
    assert "mean_pr_auc" in res["summary"]
    assert "worst_fold" in res["summary"]
