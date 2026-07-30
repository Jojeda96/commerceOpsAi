# Reproducibilidad — Predictor de Atrasos V4

Este documento describe los pasos exactos para reproducir los resultados del modelo a partir del repositorio en estado V4.

---

## Prerrequisitos

- Python 3.11+
- PostgreSQL (vía Docker)
- Dataset Olist disponible (ver instrucciones de carga)
- Todas las dependencias en `apps/ml-service/requirements.txt`

---

## Parámetros fijos

| Parámetro | Valor |
|---|---|
| SHA base | `3d6f541b7b92d1221f6be5bdd9c6c76e5ca02606` |
| Random seed | `42` |
| Feature contract | `delivery-features-v3.0.0` |
| Quality gates | `delivery-gates-v3` |
| Bundle schema | `3.0` |

---

## Secuencia de reproducción

```bash
# 1. Validar contrato de features
PYTHONPATH=. python scripts/contracts/validate_delivery_contract.py

# 2. Construir dataset con modo full (requiere datos Olist en DB)
python scripts/build_delivery_dataset.py --mode full

# 3. Construir snapshots point-in-time (requiere DB)
python scripts/ml/sync_delivery_feature_snapshots.py

# 4. Entrenar champion
PYTHONPATH=. python scripts/train_delivery_champion.py

# 5. Validar artefactos
PYTHONPATH=. python scripts/release/verify_v4.py
```

---

## Checksums de artefactos V4

| Artefacto | SHA-256 |
|---|---|
| `data/models/delivery_delay_champion.joblib` | `5c9b13de4e1ce8407a97001799dbce66e9206c3ec0b020314375b01bbe7651d5` |
| `data/models/delivery_delay_metrics.json` | `69067b84521e2a2661db24b2514652d9d192f4f132455dec33734924378dda5e` |
| `data/processed/delivery_model_manifest.json` | `b0c76b4c375e4f337848b43ed664779e68128414ff88277d9c575ab44ec2e582` |

---

## Tests de reproducción

```bash
# Tests de contrato
PYTHONPATH=. pytest tests/contracts -q

# Tests ML
PYTHONPATH=. pytest tests/ml -q

# Tests del servicio
PYTHONPATH=. pytest apps/ml-service/tests -q
```

---

## Notas de reproducción

- Si el entrenamiento se realiza en un hardware diferente, pueden existir diferencias mínimas de punto flotante en las métricas (±0.0001).
- El random_seed=42 garantiza reproducibilidad en la selección de folds, pero el orden de carga del dataset puede variar si se usa paralelismo.
- Los checksums son válidos para los artefactos generados en el entorno de desarrollo original.
