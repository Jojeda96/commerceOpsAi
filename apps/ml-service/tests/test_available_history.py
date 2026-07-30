import sys
import os
import pandas as pd

root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from scripts.ml.available_history import add_available_outcome_history


def test_unfinished_prior_order_is_not_visible():
    df = pd.DataFrame({
        "internal_order_id": ["A", "B", "C"],
        "purchase_date": pd.to_datetime([
            "2020-01-01",
            "2020-01-02",
            "2020-01-21",
        ]),
        "delivered_date": pd.to_datetime([
            "2020-01-20",
            "2020-01-05",
            "2020-01-25",
        ]),
        "seller": ["S1", "S1", "S1"],
        "is_delayed": [1, 0, 0],
    })

    result = add_available_outcome_history(
        df,
        "seller",
        "seller",
    )

    order_b = result.loc[
        result["internal_order_id"] == "B"
    ].iloc[0]

    assert order_b["seller_prior_orders"] == 0

    order_c = result.loc[
        result["internal_order_id"] == "C"
    ].iloc[0]

    assert order_c["seller_prior_orders"] == 2
    assert order_c["seller_prior_late_rate"] == 0.5
