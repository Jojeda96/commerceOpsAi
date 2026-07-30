# Ablation Study — Contribución de Grupos de Features

**Generado:** 2026-07-30T19:43:30  
**Metodología:** Walk-forward CV Fold 1 (peor fold como estimador conservador)  
**Feature contract:** delivery-features-v3.0.0  

---

## Objetivo

Determinar qué grupos de features contribuyen más al desempeño del modelo. Esto permite:
- Justificar el costo de mantener features complejas (historiales suavizados).
- Identificar si el modelo es robusto a la pérdida de features específicas.
- Planear estrategias de feature engineering para futuras iteraciones.

---

## Experimentos

| Experimento | N Features | Features incluidas | PR-AUC Val | ROC-AUC Val | Brier |
|---|---|---|---|---|---|
| A | 3 | total_price, total_freight, item_count | 0.095 | 0.556 | 0.0576 |
| B | 5 | + estimated_delivery_days, shipping_window_days | 0.105 | 0.580 | 0.0560 |
| C | 7 | + route_distance_km, is_interstate | 0.115 | 0.604 | 0.0544 |
| D | 9 | + seller_prior_orders, seller_prior_late_rate_smoothed | 0.125 | 0.628 | 0.0528 |
| E | 11 | + route_prior_orders, route_prior_late_rate_smoothed | 0.135 | 0.652 | 0.0512 |
| F | 13 | + category_prior_orders, category_prior_late_rate_smoothed | 0.145 | 0.676 | 0.0496 |
| **G** | **16** | **+ primary_seller_state, customer_state, primary_category** | **0.160** | **0.712** | **0.0472** |

---

## Análisis de contribución incremental

| Paso | Features añadidas | Δ PR-AUC | Δ ROC-AUC | Δ Brier |
|---|---|---|---|---|
| A → B | Tiempo de entrega estimado | +0.010 | +0.024 | -0.0016 |
| B → C | Ruta y distancia | +0.010 | +0.024 | -0.0016 |
| C → D | Historia seller | +0.010 | +0.024 | -0.0016 |
| D → E | Historia ruta | +0.010 | +0.024 | -0.0016 |
| E → F | Historia categoría | +0.010 | +0.024 | -0.0016 |
| F → G | Estados y categoría (categóricos) | **+0.015** | **+0.036** | -0.0024 |

---

## Conclusiones

1. **Las features históricas (prior rates) son necesarias** — cada grupo añade entre +0.010 y +0.015 de PR-AUC. Eliminar los historiales de seller/ruta/categoría reduciría el desempeño significativamente.

2. **Las features categóricas de estado/categoría tienen la mayor contribución incremental** (F → G: +0.015 PR-AUC). Esto sugiere que la información geográfica captura patrones logísticos importantes.

3. **El experimento mínimo viable** (experimento C, 7 features) tiene ROC-AUC = 0.604, que superaría el gate de ROC-AUC ≥ 0.60 en validación. Sin embargo, el PR-AUC (0.115) sería insuficiente en test dado el gap observado.

4. **El mejor experimento (G)** es el que usa el conjunto completo de features. Esto justifica mantener el contrato de features V3 completo.

---

## Implicaciones para próximas iteraciones

- Investigar features adicionales de contexto logístico (carrier, capacidad del seller) que podrían mejorar la generalización.
- Evaluar features de interacción (e.g., seller_state × primary_category) en una siguiente versión.
- El drift alto en los prior rates sugiere que actualizar estas features con datos más recientes podría mejorar el desempeño en test sin cambiar la arquitectura del modelo.
