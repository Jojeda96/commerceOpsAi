import pytest
import pandas as pd
import numpy as np
from scripts.ml.split import temporal_train_validation_test_split, expanding_time_folds


def test_temporal_split_order():
    dates = pd.date_range("2020-01-01", periods=100, freq="D")
    df = pd.DataFrame(
        {
            "purchase_date": dates,
            "is_delayed": np.random.choice([0, 1], size=100, p=[0.9, 0.1]),
        }
    )

    train, val, test = temporal_train_validation_test_split(df, 0.70, 0.15)

    assert len(train) == 70
    assert len(val) == 15
    assert len(test) == 15

    assert train["purchase_date"].max() <= val["purchase_date"].min()
    assert val["purchase_date"].max() <= test["purchase_date"].min()


def test_expanding_time_folds_chronology():
    dates = pd.date_range("2020-01-01", periods=200, freq="D")
    df = pd.DataFrame(
        {
            "purchase_date": dates,
            "is_delayed": np.random.choice([0, 1], size=200, p=[0.9, 0.1]),
        }
    )

    folds = list(expanding_time_folds(df, n_folds=3))
    assert len(folds) == 3

    for train_idx, valid_idx in folds:
        assert train_idx.max() < valid_idx.min()
