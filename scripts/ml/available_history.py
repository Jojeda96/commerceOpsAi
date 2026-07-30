from __future__ import annotations

from collections import defaultdict
from typing import Dict, Hashable

import numpy as np
import pandas as pd


def add_available_outcome_history(
    df: pd.DataFrame,
    group_col: str,
    prefix: str,
    strength: float = 20.0,
    default_prior: float = 0.08,
) -> pd.DataFrame:
    """
    Calcula acumulados históricos usando EXCLUSIVAMENTE pedidos entregados ANTES
    de la fecha de compra del pedido actual (delivered_date < current.purchase_date).
    Evita todo temporal leakage de labels aún no observados.
    Numpy-optimized loop for maximum execution speed.
    """
    out = df.copy()

    if "internal_order_id" not in out.columns:
        if "order_id" in out.columns:
            out["internal_order_id"] = out["order_id"]
        else:
            out["internal_order_id"] = [f"ord_{i}" for i in range(len(out))]

    if "delivered_date" not in out.columns:
        if "order_delivered_customer_date" in out.columns:
            out["delivered_date"] = out["order_delivered_customer_date"]
        else:
            out["delivered_date"] = out["purchase_date"]

    required = {
        "purchase_date",
        "delivered_date",
        "is_delayed",
        "internal_order_id",
        group_col,
    }

    missing = required - set(out.columns)
    if missing:
        raise ValueError(
            f"Faltan columnas obligatorias para disponibilidad temporal: {sorted(missing)}"
        )

    out["purchase_date"] = pd.to_datetime(out["purchase_date"])
    out["delivered_date"] = pd.to_datetime(out["delivered_date"])

    # Ordenar por fecha de compra manteniendo orden estable
    original_index = out.index
    out = out.sort_values(
        ["purchase_date", "internal_order_id"],
    ).reset_index(drop=True)

    # Extraer eventos de entrega con outcomes conocidos
    outcomes = (
        out[
            [
                "delivered_date",
                group_col,
                "is_delayed",
            ]
        ]
        .sort_values("delivered_date")
        .reset_index(drop=True)
    )

    group_count: Dict[Hashable, int] = defaultdict(int)
    group_late: Dict[Hashable, int] = defaultdict(int)

    global_count = 0
    global_late = 0
    pointer = 0

    n_rows = len(out)
    prior_orders = np.zeros(n_rows, dtype=int)
    prior_rate = np.full(n_rows, np.nan)
    smoothed_rate = np.full(n_rows, np.nan)

    purchase_dates = out["purchase_date"].to_numpy()
    group_keys = out[group_col].fillna("UNK").astype(str).to_numpy()

    outcome_dates = outcomes["delivered_date"].to_numpy()
    outcome_keys = outcomes[group_col].fillna("UNK").astype(str).to_numpy()
    outcome_targets = outcomes["is_delayed"].to_numpy(dtype=int)
    n_outcomes = len(outcomes)

    for row_index in range(n_rows):
        current_time = purchase_dates[row_index]

        while pointer < n_outcomes:
            if outcome_dates[pointer] > current_time:
                break
            if outcome_dates[pointer] == current_time and pointer >= row_index:
                break

            key = outcome_keys[pointer]
            target = outcome_targets[pointer]

            group_count[key] += 1
            group_late[key] += target
            global_count += 1
            global_late += target

            pointer += 1

        key = group_keys[row_index]
        count = group_count[key]
        late = group_late[key]

        global_prior = (
            global_late / global_count
            if global_count > 0
            else default_prior
        )

        prior_orders[row_index] = count

        if count > 0:
            prior_rate[row_index] = late / count

        smoothed_rate[row_index] = (
            late + strength * global_prior
        ) / (
            count + strength
        )

    out[f"{prefix}_prior_orders"] = prior_orders
    out[f"{prefix}_prior_late_rate"] = prior_rate
    out[f"{prefix}_prior_late_rate_smoothed"] = smoothed_rate

    out.index = original_index
    return out
