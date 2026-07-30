import pytest
import pandas as pd
import numpy as np
from scripts.ml.temporal_history import add_prior_group_stats


def test_prior_rate_does_not_use_current_target():
    df = pd.DataFrame(
        {
            "purchase_date": pd.to_datetime(
                ["2020-01-01", "2020-01-02", "2020-01-03"]
            ),
            "seller": ["A", "A", "A"],
            "is_delayed": [0, 1, 0],
        }
    )

    result = add_prior_group_stats(df, "seller", "seller")

    # Fila 0: 0 pedidos previos -> prior_late_rate es NaN o 0 pedidos
    assert pd.isna(result.iloc[0]["seller_prior_late_rate"])
    assert result.iloc[0]["seller_prior_orders"] == 0

    # Fila 1: 1 pedido previo (target 0) -> prior_late_rate debe ser 0.0
    assert result.iloc[1]["seller_prior_late_rate"] == 0.0
    assert result.iloc[1]["seller_prior_orders"] == 1

    # Fila 2: 2 pedidos previos (targets 0 y 1) -> prior_late_rate debe ser 0.5
    assert result.iloc[2]["seller_prior_late_rate"] == 0.5
    assert result.iloc[2]["seller_prior_orders"] == 2


def test_no_future_information_in_prior_rates():
    # El pedido 1 falla pero ocurre en el futuro (2020-01-05)
    # El pedido 0 ocurre antes (2020-01-01). No debe enterarse del fallo futuro.
    df = pd.DataFrame(
        {
            "purchase_date": pd.to_datetime(["2020-01-05", "2020-01-01"]),
            "seller": ["A", "A"],
            "is_delayed": [1, 0],
        }
    )

    result = add_prior_group_stats(df, "seller", "seller")
    
    # Al ordenar por purchase_date, 2020-01-01 es el primero
    first_order = result.iloc[0] # 2020-01-01
    second_order = result.iloc[1] # 2020-01-05

    assert first_order["seller_prior_orders"] == 0
    assert pd.isna(first_order["seller_prior_late_rate"])

    assert second_order["seller_prior_orders"] == 1
    assert second_order["seller_prior_late_rate"] == 0.0
