# Model Card — Delivery Delay Predictor (`delivery-xgb-v1.1.0`)

## 📌 Resumen General
- **Modelo:** `XGBClassifier` (Gradient Boosted Decision Trees).
- **Tarea:** Clasificación binaria (`is_delayed = 1` si la entrega efectiva supera la fecha estimada de entrega).
- **Despliegue:** FastAPI Service (`apps/ml-service`).
- **Versión de Modelo:** `v1.1.0`.

---

## 📐 Dataset & Procesamiento
- **Fuente de Datos:** Dataset público de E-Commerce Brasileño (Olist, 2016-2018).
- **Unidad de Análisis:** Pedido único (`order_id`). La agregación por pedido previene la fuga de información entre ítems.
- **División Temporal Estricta:**
  - **Entrenamiento (70%):** Muestra cronológica inicial para ajuste de parámetros y `scale_pos_weight`.
  - **Validación (15%):** Muestra intermedia para ajuste del umbral de decisión operativo (`optimal_threshold`).
  - **Prueba / Test (15%):** Muestra final independiente evaluada únicamente una vez para la métrica definitiva.

---

## 🛠️ Variables de Entrada (Features)
1. `is_interstate`: Indicador binario si el estado del vendedor difiere del cliente.
2. `freight_value`: Costo total de flete del pedido (R$).
3. `price`: Precio total de productos del pedido (R$).
4. `freight_ratio`: Proporción del flete respecto al valor total.
5. `product_weight_g`: Peso total acumulado de los productos (gramos).
6. `product_volume_cm3`: Volumen total acumulado (cm³).
7. `purchase_dow`: Día de la semana de la compra (0=Lunes, 6=Domingo).
8. `purchase_hour`: Hora del día de la compra (0-23).
9. `item_count`: Cantidad total de artículos contenidos en el pedido.

---

## 📊 Métricas de Evaluación & Comparación

| Métrica | Modelo XGBoost (`v1.1.0`) | Baseline Logistic Regression | Baseline Dummy (Most Frequent) |
|---|---|---|---|
| **Optimal Threshold** | Guardado en `metrics.json` | 0.50 | - |
| **ROC-AUC** | Eval en Test Set | Eval en Test Set | 0.50 |
| **PR-AUC** | Eval en Test Set | N/A | Prevalencia Base |
| **F1 Score** | Optimizado en Validation | Baseline | 0.00 |
| **Brier Score** | Calibración Probabilística | Baseline | N/A |

---

## ⚠️ Limitaciones Conocidas & Advertencias

1. **Atribución con SHAP (No Causal):** El endpoint `/models/delivery-delay/explain` utiliza `SHAP TreeExplainer` para atribución de características a la predicción, no para inferencia de causalidad física o logística.
2. **Contexto Geográfico:** Entrenado sobre rutas y logística de Brasil en 2016-2018. Las predicciones en entornos u operadores logísticos diferentes requieren reentrenamiento.
3. **Threshold Dinámico:** La inferencia en producción lee `optimal_threshold` directamente desde `delivery_delay_metrics.json` y mapea los niveles de riesgo de forma transparente:
   - `LOW`: Probabilidad < 0.5 × Threshold
   - `MEDIUM`: 0.5 × Threshold ≤ Probabilidad < Threshold
   - `HIGH`: Probabilidad ≥ Threshold
