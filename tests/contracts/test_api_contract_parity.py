import json
import pytest
from pathlib import Path
from app.models.delivery_contracts import PredictionRequest

PROJECT_ROOT = Path(__file__).resolve().parents[2]
CONTRACT_PATH = PROJECT_ROOT / "data" / "contracts" / "delivery_feature_contract.v3.json"
REQUEST_EXAMPLE_PATH = PROJECT_ROOT / "data" / "contracts" / "delivery_prediction_request.example.json"

def test_pydantic_schema_matches_contract_v3():
    with open(REQUEST_EXAMPLE_PATH, "r", encoding="utf-8") as f:
        request_example = json.load(f)
    
    # Validation should succeed without error
    req = PredictionRequest(**request_example)
    assert req.scenario_id == request_example["scenario_id"]
    assert req.primary_seller_state == request_example["primary_seller_state"]
    assert req.customer_state == request_example["customer_state"]
