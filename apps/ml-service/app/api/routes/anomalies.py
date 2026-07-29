from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
import numpy as np

router = APIRouter(prefix="/anomalies", tags=["Anomalies"])

class AnomalyRequest(BaseModel):
    values: List[float]
    threshold: float = 3.0

class AnomalyResponse(BaseModel):
    median: float
    mad: float
    anomaly_indices: List[int]
    z_scores: List[float]

@router.post("/detect", response_model=AnomalyResponse)
async def detect_anomalies(request: AnomalyRequest):
    values = np.array(request.values, dtype=float)
    if len(values) == 0:
        return AnomalyResponse(median=0.0, mad=0.0, anomaly_indices=[], z_scores=[])

    median = float(np.median(values))
    mad = float(np.median(np.abs(values - median)))
    scaled_mad = 1.4826 * mad

    z_scores = []
    anomaly_indices = []

    for idx, v in enumerate(values):
        z = float((v - median) / scaled_mad) if scaled_mad > 0 else 0.0
        z_scores.append(round(z, 4))
        if abs(z) > request.threshold:
            anomaly_indices.append(idx)

    return AnomalyResponse(
        median=round(median, 4),
        mad=round(mad, 4),
        anomaly_indices=anomaly_indices,
        z_scores=z_scores
    )
