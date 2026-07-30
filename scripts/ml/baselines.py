import pandas as pd
import numpy as np
from sklearn.dummy import DummyClassifier
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


NUMERIC_FEATURES = [
    "total_price",
    "total_freight",
    "freight_ratio",
    "estimated_delivery_days",
    "shipping_window_days",
    "avg_item_price",
    "avg_item_weight_g",
    "avg_item_volume_cm3",
    "route_distance_km",
    "purchase_dow",
    "purchase_hour",
    "purchase_month",
    "purchase_week",
    "item_count",
    "seller_count",
]

CATEGORICAL_FEATURES = [
    "primary_seller_state",
    "customer_state",
    "route_pair",
    "primary_category",
    "is_interstate",
]


def build_preprocessor(numeric_features=None, categorical_features=None):
    if numeric_features is None:
        numeric_features = NUMERIC_FEATURES
    if categorical_features is None:
        categorical_features = CATEGORICAL_FEATURES

    numeric_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )

    categorical_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            (
                "onehot",
                OneHotEncoder(
                    handle_unknown="ignore",
                    min_frequency=50,
                ),
            ),
        ]
    )

    return ColumnTransformer(
        transformers=[
            ("numeric", numeric_pipeline, numeric_features),
            ("categorical", categorical_pipeline, categorical_features),
        ]
    )


def build_logistic_baseline(numeric_features=None, categorical_features=None):
    preprocessor = build_preprocessor(numeric_features, categorical_features)
    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "model",
                LogisticRegression(
                    max_iter=2_000,
                    class_weight="balanced",
                    random_state=42,
                ),
            ),
        ]
    )


def build_dummy_baseline():
    return DummyClassifier(strategy="prior")
