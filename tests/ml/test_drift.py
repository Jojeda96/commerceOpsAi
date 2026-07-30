import pytest
import pandas as pd
import numpy as np
from scripts.ml.drift import analyze_drift, calculate_psi

def test_calculate_psi_zero_for_identical_distributions():
    arr = np.random.normal(0, 1, 1000)
    psi = calculate_psi(arr, arr)
    assert psi == pytest.approx(0.0, abs=0.05)

def test_analyze_drift_detects_unseen_categories():
    train_df = pd.DataFrame({"primary_category": ["catA", "catB"], "total_price": [10.0, 20.0]})
    test_df = pd.DataFrame({"primary_category": ["catA", "catC"], "total_price": [10.0, 25.0]})

    res = analyze_drift(train_df, test_df, num_cols=["total_price"], cat_cols=["primary_category"])
    assert "primary_category" in res["unseen_categories_report"]
    assert res["unseen_categories_report"]["primary_category"]["unseen_count"] == 1
    assert "catC" in res["unseen_categories_report"]["primary_category"]["unseen_samples"]
