# Model Card — Delivery Delay Predictor (`delivery-risk-v2.0.0`)

## 📌 Resumen General
- **Modelo:** `XGBClassifier` (Hist Gradient Boosted Trees).
- **Tarea:** Clasificación binaria (`is_delayed = 1` si fecha real > fecha estimada de entrega).
- **Despliegue:** FastAPI Service (`apps/ml-service`).
- **Versión de Modelo:** `v2.0.0`.
- **Estado de Despliegue:** 🔴 `EXPERIMENTAL_NOT_APPROVED`
- **Razones del Quality Gate:** ["ROC_AUC_BELOW_0_60", "PR_AUC_INSUFFICIENT_LIFT_OVER_PREVALENCE", "DOES_NOT_BEAT_LOGISTIC_ROC_AUC", "DOES_NOT_BEAT_LOGISTIC_PR_AUC", "RECALL_BELOW_0_50", "PRECISION_BELOW_0_15"]

---

## 📐 Dataset & Procesamiento (Olist Completo)
- **Muestras Totales:** 96470 pedidos.
- **División Temporal Estricta:** Train (70%: 67529), Validation (15%: 14470), Test (15%: 14471).
- **Prevalencia en Test:** 6.6132% (957 atrasos reales).
- **Momento de Predicción:** `ORDER_PURCHASE` (sin leakage temporal de entrega o reseñas).

---

## 📊 Métricas Definitivas Evaluadas en Test Set

| Métrica | XGBoost Tuned (`v2.0.0`) | Baseline Logistic Regression | Baseline Dummy (Prior) |
|---|---|---|---|
| **Optimal Threshold** | `0.0954` | 0.50 | - |
| **ROC-AUC** | `0.4652` (CI 95%: [0.4462, 0.4864]) | `0.5732` | 0.5000 |
| **PR-AUC** | `0.0704` (CI 95%: [0.0633, 0.0801]) | `0.0965` | `0.0661` |
| **PR-AUC Lift** | `1.0653x` | - | 1.0x |
| **Precision** | `0.0643` | `0.0779` | 0.0000 |
| **Recall** | `0.2351` | `0.8433` | 0.0000 |
| **F1 Score** | `0.1010` | `0.1426` | 0.0000 |
| **Brier Score** | `0.0647` | N/A | N/A |
| **Precision@5% Top** | `0.1065` | N/A | - |
| **Recall@5% Top** | `0.0805` | N/A | - |
| **Lift@5% Top** | `1.6104x` | N/A | - |

---

## ⚠️ Gobernanza y Bloqueo Operativo

1. **Gate Automático:** Estado actual `EXPERIMENTAL_NOT_APPROVED`.
2. **Inferencia Operativa:** Servido a través del bundle versionado `.joblib`.
