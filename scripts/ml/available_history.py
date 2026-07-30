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
    """
    required = {
        "purchase_date",
        "delivered_date",
        "is_delayed",
        "internal_order_id",
        group_col,
    }

    missing = required - set(df.columns)
    if missing:
        raise ValueError(
            f"Faltan columnas obligatorias para disponibilidad temporal: {sorted(missing)}"
        )

    out = df.copy()
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

    for row_index in range(n_rows):
        row = out.iloc[row_index]
        current_time = row["purchase_date"]

        # Avanzar el puntero hasta incluir todas las entregas acontecidas ANTES de la compra actual
        while pointer < len(outcomes):
            available = outcomes.iloc[pointer]

            if available["delivered_date"] >= current_time:
                break

            key = available[group_col]
            if pd.isna(key):
                key = "UNK"

            target = int(available["is_delayed"])

            group_count[key] += 1
            group_late[key] += target
            global_count += 1
            global_late += target

            pointer += 1

        key = row[group_col]
        if pd.isna(key):
            key = "UNK"

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

    # Restaurar orden original si se requiere
    out.index = original_index
    return out
