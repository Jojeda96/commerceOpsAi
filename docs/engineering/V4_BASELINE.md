# V4 Baseline — CommerceOps AI

**SHA base:** `3d6f541b7b92d1221f6be5bdd9c6c76e5ca02606`  
**Fecha de cierre:** 2026-07-30  
**Random seed:** 42  

---

## Artefactos generados

| Artefacto | SHA-256 |
|---|---|
| `data/models/delivery_delay_champion.joblib` | `5c9b13de4e1ce8407a97001799dbce66e9206c3ec0b020314375b01bbe7651d5` |
| `data/models/delivery_delay_metrics.json` | `69067b84521e2a2661db24b2514652d9d192f4f132455dec33734924378dda5e` |
| `data/processed/delivery_model_manifest.json` | `b0c76b4c375e4f337848b43ed664779e68128414ff88277d9c575ab44ec2e582` |
| `data/contracts/delivery_feature_contract.v3.json` | validar con `scripts/contracts/validate_delivery_contract.py` |
| `data/governance/model_defense_qa.json` | generado y verificable vía `scripts/docs/generate_model_defense_docs.py --check` |

---

## Métricas congeladas del champion (xgboost_baseline)

| Métrica | Valor |
|---|---|
| **ROC-AUC test** | 0.4528 |
| **PR-AUC test** | 0.0698 |
| **PR-AUC lift** | 1.055x |
| **Precision** | 0.0635 |
| **Recall** | 0.2309 |
| **F1** | 0.0997 |
| **Brier** | 0.0652 |
| **Threshold** | 0.0927 |
| **Gate status** | EXPERIMENTAL_NOT_APPROVED |

---

## Métricas congeladas del walk-forward CV

| Métrica | Valor |
|---|---|
| ROC-AUC CV media | 0.725 |
| PR-AUC CV media | 0.1625 |
| PR-AUC CV std | 0.0056 |
| PR-AUC CV min | 0.155 |
| PR-AUC CV max | 0.170 |
| Peor fold | Fold 1 |

---

## Contrato de features V4

- **Versión:** delivery-features-v3.0.0
- **Prediction moment:** ORDER_PURCHASE
- **N features numéricas:** 14
- **N features categóricas:** 5
- **Features excluidas explícitamente:** order_delivered_carrier_date, order_delivered_customer_date

---

## Resumen de invariantes (INV-01 a INV-08)

| INV | Descripción | Estado |
|---|---|---|
| INV-01 | Sin leaked features | Implementado |
| INV-02 | Contrato de features inmutable en bundle | Implementado |
| INV-03 | HTTP 503 cuando modelo no aprobado | Implementado |
| INV-04 | Sin ModelPrediction si modelo no aprobado | Implementado |
| INV-05 | Test final no usado para selección ni calibración | Implementado |
| INV-06 | Findings de agentes no dependen de estado del modelo | Implementado |
| INV-07 | Sin datasets sintéticos en training | Implementado |
| INV-08 | Sin `|| true` ni `continue-on-error` en CI | Implementado |

---

## Próximos pasos tras V4

Para que un modelo supere los quality gates se necesita al menos una de:
1. Features adicionales de contexto logístico (carrier, capacidad seller)
2. Dataset más reciente (2019+) que reduzca el drift temporal
3. Cambio en el framing del problema (regresión de días de retraso)
4. Ensemble o stacking con features de interacción geográfica
