import os
import sys
import json
import pandas as pd
import numpy as np

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


def get_root_dir() -> str:
    curr = os.path.abspath(__file__)
    while curr and not os.path.exists(os.path.join(curr, "data")):
        parent = os.path.dirname(curr)
        if parent == curr:
            break
        curr = parent
    return curr if os.path.exists(os.path.join(curr, "data")) else os.getcwd()


def audit_data_quality():
    root_dir = get_root_dir()
    parquet_path = os.path.join(root_dir, "data", "processed", "delivery_model_dataset.parquet")
    
    if not os.path.exists(parquet_path):
        raise FileNotFoundError(f"No existe el dataset en {parquet_path}. Ejecute build_delivery_dataset.py primero.")

    df = pd.read_parquet(parquet_path)
    df["purchase_date"] = pd.to_datetime(df["purchase_date"])

    total_orders = len(df)
    duplicates = total_orders - df["internal_order_id"].nunique()
    positives = int(df["is_delayed"].sum())
    positive_ratio = float(positives / total_orders) if total_orders > 0 else 0.0

    # Distribución por mes
    df["year_month"] = df["purchase_date"].dt.to_period("M").astype(str)
    monthly_dist = (
        df.groupby("year_month", as_index=False)
        .agg(
            order_count=("internal_order_id", "count"),
            positive_count=("is_delayed", "sum"),
        )
    )
    monthly_dist["positive_ratio"] = (monthly_dist["positive_count"] / monthly_dist["order_count"]).round(4)

    missingness = {col: int(df[col].isna().sum()) for col in df.columns}

    report = {
        "order_count": total_orders,
        "positive_count": positives,
        "positive_ratio": round(positive_ratio, 4),
        "date_min": df["purchase_date"].min().isoformat(),
        "date_max": df["purchase_date"].max().isoformat(),
        "duplicate_order_count": duplicates,
        "invalid_date_order_count": int((df["delivered_date"] < df["purchase_date"]).sum()),
        "missingness": missingness,
        "class_distribution_by_month": monthly_dist.to_dict(orient="records"),
    }

    report_path = os.path.join(root_dir, "data", "processed", "delivery_data_quality_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"[DataQuality] [OK] Reporte de calidad guardado en: {report_path}")
    print(f"[DataQuality] Resumen: {total_orders} pedidos, {positives} atrasos ({positive_ratio:.2%}), {duplicates} duplicados.")
    return report


if __name__ == "__main__":
    audit_data_quality()
