import pandas as pd
import numpy as np
from typing import Tuple, Generator


def temporal_train_validation_test_split(
    df: pd.DataFrame,
    train_ratio: float = 0.70,
    validation_ratio: float = 0.15,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    ordered = df.sort_values("purchase_date").reset_index(drop=True)

    n = len(ordered)
    train_end = int(n * train_ratio)
    validation_end = int(n * (train_ratio + validation_ratio))

    train = ordered.iloc[:train_end].copy()
    validation = ordered.iloc[train_end:validation_end].copy()
    test = ordered.iloc[validation_end:].copy()

    assert train["purchase_date"].max() <= validation["purchase_date"].min(), (
        "Invariante violada: train debe ser estrictamente anterior a validation"
    )
    assert validation["purchase_date"].max() <= test["purchase_date"].min(), (
        "Invariante violada: validation debe ser strictly anterior a test"
    )

    return train, validation, test


def expanding_time_folds(
    df: pd.DataFrame, n_folds: int = 4
) -> Generator[Tuple[np.ndarray, np.ndarray], None, None]:
    ordered = df.sort_values("purchase_date").reset_index(drop=True)
    n = len(ordered)
    boundaries = np.linspace(0.45, 1.0, n_folds + 1)

    for fold in range(n_folds):
        train_end = int(n * boundaries[fold])
        valid_end = int(n * boundaries[fold + 1])

        train_idx = np.arange(0, train_end)
        valid_idx = np.arange(train_end, valid_end)

        if len(valid_idx) == 0:
            continue

        y_valid = ordered.iloc[valid_idx]["is_delayed"].to_numpy()
        if y_valid.sum() < 20:
            # Advertencia o ajuste si hay muy pocos positivos
            pass

        yield train_idx, valid_idx
