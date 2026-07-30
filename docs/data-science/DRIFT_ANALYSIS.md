# Análisis de Drift — Features entre Entrenamiento y Test

**Feature contract:** delivery-features-v3.0.0  
**Generado:** 2026-07-30T19:43:30  
**Dataset manifest SHA256:** b0c76b4c375e4f337848b43ed664779e68128414ff88277d9c575ab44ec2e582  

> ⚠️ **El drift no implica causalidad.** Un drift HIGH en una feature no significa que sea la causa del gap de desempeño. El drift identifica diferencias distribucionales, pero la relación con el rendimiento es correlacional.

---

## Metodología

- **PSI (Population Stability Index):** PSI ≥ 0.2 indica drift HIGH, 0.1–0.2 MEDIUM, < 0.1 LOW.
- **KS (Kolmogorov-Smirnov):** Distancia máxima entre distribuciones. p-value < 0.05 indica diferencia estadísticamente significativa.
- **Período train:** 2016-09-15 → 2018-06-21 (sin test).
- **Período test:** 2018-07+ (separado temporalmente).

---

## Features Numéricas con Drift HIGH

| Feature | PSI | KS Stat | Δ Media | Interpretación |
|---|---|---|---|---|
| estimated_delivery_days | 0.4554 | 0.3375 | -6.11 | Los días estimados fueron menores en test (posible mejora de carriers en ese período) |
| purchase_month | 14.513 | 0.5129 | +1.33 | Test cae en meses específicos no representados en training |
| purchase_week | 14.521 | 0.5421 | +5.91 | Correlacionado con purchase_month |
| seller_prior_late_rate_smoothed | 2.891 | 0.5099 | +0.036 | Tasa de atraso de sellers cambió entre períodos |
| route_prior_late_rate_smoothed | 1.666 | 0.6101 | +0.032 | Tasas de ruta cambiaron entre períodos |
| category_prior_late_rate_smoothed | 9.211 | 0.7763 | +0.036 | Mayor drift — categorías con patrones más variables |
| route_prior_orders | 2.029 | 0.3584 | +7854.69 | Acumulación de historial en test — las rutas tienen más órdenes históricas |
| total_freight | 0.307 | 0.1814 | +2.41 | Flete aumentó en test |
| shipping_window_days | 0.290 | 0.368 | -1.61 | Ventana de envío disminuyó — sellers mejoraron límites de shipping |

---

## Features Numéricas con Drift LOW

| Feature | PSI | KS Stat | Nivel |
|---|---|---|---|
| total_price | 0.0087 | 0.0124 | LOW |
| freight_ratio | 0.0092 | 0.0454 | LOW |
| avg_item_price | 0.0048 | 0.0162 | LOW |
| avg_item_weight_g | 0.0278 | 0.0670 | LOW |
| avg_item_volume_cm3 | 0.0316 | 0.0661 | LOW |
| route_distance_km | 0.0250 | 0.0630 | LOW |
| purchase_dow | 0.0019 | 0.0171 | LOW |
| purchase_hour | 0.0020 | 0.0097 | LOW |
| seller_prior_orders | 0.0425 | 0.1043 | LOW |
| item_count | 0.0008 | 0.0083 | LOW |
| seller_count | 0.0000 | 0.0053 | LOW |

---

## Features Categóricas

| Feature | Cardinalidad train | Cardinalidad test | Unseen rate | Nivel |
|---|---|---|---|---|
| primary_seller_state | 22 | 19 | 0.00% | LOW |
| customer_state | 27 | 27 | 0.00% | LOW |
| route_pair | 381 | 286 | 0.20% | LOW |
| primary_category | 72 | 68 | 0.08% | LOW |
| is_interstate | 2 | 2 | 0.00% | LOW |

Los unseen rates son bajos pero no nulos. El pipeline maneja estos casos mediante el imputer del preprocessor.

---

## Análisis e Interpretación

### Drift en prior rates

El drift más significativo ocurre en las tasas históricas suavizadas (`_prior_late_rate_smoothed`). Estas features son calculadas como el historial acumulado hasta la fecha de compra. En test, que cae en un período posterior, estos historiales incluyen el impacto de eventos del 2018-Q2 (como la huelga de camioneros), lo que cambia la distribución respecto al período de entrenamiento.

### Drift en purchase_month/week

El drift extremo en `purchase_month` (PSI=14.5) refleja que el test cubre meses específicos que tienen distribución muy diferente al entrenamiento completo. Esto es esperado en validación temporal, pero indica que features temporales tienen alta dependencia del período evaluado.

### Conclusión

El drift temporal en las prior rates y las features temporales es la causa más probable del gap entre CV y test. El modelo aprendió patrones de un período que no se transfieren bien al período de test.

---

## Siguiente paso sugerido

Si se dispone de datos más recientes: evaluar si el reentrenamiento con datos del período de test mejora la generalización a datos aún más recientes. Esto validaría si el drift es estacional (corregigle con retrain periódico) o estructural (requiere nuevas features).
