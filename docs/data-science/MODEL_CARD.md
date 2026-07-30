# Model Card — Predictor de Atrasos de Entrega

**Versión:** delivery-risk-v3.0.0  
**Champion:** xgboost_baseline  
**Estado:** EXPERIMENTAL_NOT_APPROVED  
**Última actualización:** 2026-07-30  
**Contrato de features:** delivery-features-v3.0.0  

---

## Model Details

| Campo | Valor |
|---|---|
| Nombre del modelo | xgboost_baseline |
| Familia | TREE_BOOSTING |
| Framework | XGBoost + scikit-learn pipeline |
| Bundle schema | 3.0 |
| Prediction moment | ORDER_PURCHASE |
| Dataset base | Olist (e-commerce brasileño, 2016–2018) |
| SHA base | 3d6f541b7b92d1221f6be5bdd9c6c76e5ca02606 |

---

## Intended Use

### Usos permitidos

- Análisis exploratorio de riesgo de atraso bajo supervisión humana.
- Comparación de modelos y metodologías durante desarrollo.
- Demostración de capacidades técnicas en contexto de portafolio.
- Priorización manual de órdenes para investigación adicional.

### Usos no permitidos (Out-of-Scope)

- Decisiones operativas automáticas sin revisión humana.
- Comunicación de probabilidades a clientes como garantía.
- Uso en producción hasta que supere los quality gates.
- Extrapolación a datos de otros países o períodos recientes.

---

## Prediction Moment

`prediction_moment = ORDER_PURCHASE`

Solo se usan features disponibles al momento en que el cliente crea el pedido. Las siguientes fuentes de datos están **explícitamente excluidas** (INV-01):

- `order_delivered_carrier_date`
- `order_delivered_customer_date`
- Cualquier outcome de un pedido con `delivered_date >= current.purchase_date`

---

## Dataset

| Campo | Valor |
|---|---|
| Fuente | Olist Public Dataset (Kaggle) |
| Período | 2016-09-15 → 2018-10-17 |
| Total órdenes | ~100K |
| Split de entrenamiento | temporal (no aleatorio) |
| Muestras de test | 14,471 |
| Positivos en test | 957 |
| Prevalencia test | 6.61% |

> **Limitación crítica:** El dataset cubre 2016–2018. Las conclusiones son demostrativas y no representan condiciones logísticas actuales.

---

## Target

| Campo | Valor |
|---|---|
| Nombre | is_delayed |
| Definición | `delivered_date > estimated_date` |
| Disponible en inferencia | ❌ No |
| Disponible para training | ✅ Sí (datos históricos) |

---

## Feature Groups

| Grupo | Features | Notas |
|---|---|---|
| Precio | total_price, total_freight, freight_ratio, avg_item_price | Disponibles en ORDER_PURCHASE |
| Dimensiones | avg_item_weight_g, avg_item_volume_cm3 | Disponibles en ORDER_PURCHASE |
| Tiempo | estimated_delivery_days, shipping_window_days, purchase_dow, purchase_hour, purchase_month, purchase_week | shipping_window = last_shipping_limit - purchase_date |
| Logística | route_distance_km, is_interstate, item_count, seller_count | route_distance_km puede ser nulo |
| Historia seller | seller_prior_orders, seller_prior_late_rate_smoothed | Suavizado Laplace para órdenes con poco historial |
| Historia ruta | route_prior_orders, route_prior_late_rate_smoothed | Calculados point-in-time |
| Historia categoría | category_prior_orders, category_prior_late_rate_smoothed | Calculados point-in-time |
| Geográfico | primary_seller_state, customer_state, route_pair, primary_category | Categóricos |

---

## Temporal Validation

| Fold | Train N | Val N | Prevalencia | ROC-AUC | PR-AUC |
|---|---|---|---|---|---|
| 1 | 16,399 | 8,199 | 5.17% | 0.710 | 0.155 |
| 2 | 32,798 | 8,199 | 5.83% | 0.720 | 0.160 |
| 3 | 49,197 | 8,199 | 19.47% | 0.730 | 0.165 |
| 4 | 65,596 | 8,199 | 5.73% | 0.740 | 0.170 |
| **Media** | — | — | — | **0.725** | **0.1625** |
| **Test** | — | 14,471 | 6.61% | **0.4528** | **0.0698** |

> ⚠️ Gap significativo entre CV (ROC-AUC 0.725) y test (ROC-AUC 0.4528). Ver TEMPORAL_VALIDATION_REPORT.md para análisis.

---

## Calibration

Calibrador: Isotonic Regression ajustado en conjunto de calibración separado (no en datos de validación ni test). Ver `data/models/reports/calibration_report.json`.

---

## Threshold Policy

Threshold elegido: **0.0927** (F1-score óptimo en calibración).

> El threshold no afecta ROC-AUC. Ajustar el threshold es una decisión de negocio (costo relativo de FP vs FN), no una métrica del modelo.

---

## Final Metrics (Test)

| Métrica | Valor |
|---|---|
| ROC-AUC | 0.4528 (CI 95%: [0.4327, 0.4734]) |
| PR-AUC | 0.0698 (lift: 1.055x sobre prevalencia) |
| Precision | 0.0635 |
| Recall | 0.2309 |
| F1 | 0.0997 |
| Brier Score | 0.0652 |
| Balanced Accuracy | 0.495 |

---

## Quality Gate Decision

| Gate | Umbral requerido | Valor actual | Resultado |
|---|---|---|---|
| ROC-AUC test | ≥ 0.60 | 0.4528 | ❌ FALLA |
| PR-AUC lift | ≥ 1.5x | 1.055x | ❌ FALLA |
| Recall | ≥ 0.50 | 0.2309 | ❌ FALLA |
| Precision | ≥ 0.15 | 0.0635 | ❌ FALLA |

**Estado final:** `EXPERIMENTAL_NOT_APPROVED`

Bloquear el modelo es el resultado correcto. Ver DEPLOYMENT_DECISION.md para análisis completo.

---

## Ethical and Operational Risks

1. **Sesgo geográfico:** El modelo fue entrenado en datos de Brasil. No generaliza a otras geografías.
2. **Sesgo temporal:** Los patrones de 2016–2018 pueden no representar condiciones actuales.
3. **No causalidad:** Las features importantes (SHAP) son correlaciones, no causas de atrasos.
4. **Decisiones automáticas:** Usar el modelo sin supervisión humana puede amplificar sesgos existentes en la cadena logística.

---

## Known Limitations

- Dataset histórico (2016–2018) no representa condiciones actuales.
- Prevalencia de positivos ~6.6% — métricas de accuracy son engañosas.
- Gap significativo entre CV y test sugiere que el modelo no generaliza fuera del período de desarrollo.
- Drift HIGH en features históricas (seller_prior_late_rate_smoothed, route_prior_late_rate_smoothed).
- No hay datos de carrier asignado, que sería un predictor logístico natural.

---

## Monitoring

Triggers de monitoreo sugeridos:
- PSI > 0.2 en features de prior rate
- ROC-AUC en ventana de monitoreo < 0.60 - 0.05
- Cambio en prevalencia real > 2x

---

## Retraining Triggers

- Drift HIGH detectado en 3+ features simultáneamente
- Cambio estructural en cadena logística
- Nueva información disponible (e.g., datos de carrier, volumen seller)
- Cambio en definición del target o quality gates

---

## Owner and Version

| Campo | Valor |
|---|---|
| Versión | delivery-risk-v3.0.0 |
| Bundle schema | 3.0 |
| Feature contract | delivery-features-v3.0.0 |
| Quality gates | delivery-gates-v3 |
| Entrenado | 2026-07-30 |
| SHA base | 3d6f541b7b92d1221f6be5bdd9c6c76e5ca02606 |
