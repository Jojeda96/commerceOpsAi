# Análisis de Errores — Champion (xgboost_baseline)

**Test set:** 14,471 órdenes | **Positivos:** 957 (6.61%) | **Threshold:** 0.0927

---

## Confusion Matrix (Test)

```
                Predicted:  0 (a tiempo)  |  Predicted: 1 (atrasado)
Actual: 0       TN: 10,257              |  FP: 3,257
Actual: 1       FN: 736                 |  TP: 221
```

| Clase | N | Descripción |
|---|---|---|
| TN (True Negatives) | 10,257 | Predijo a tiempo → llegó a tiempo ✅ |
| FP (False Positives) | 3,257 | Predijo atrasado → llegó a tiempo ❌ (costo: intervención innecesaria) |
| FN (False Negatives) | 736 | Predijo a tiempo → llegó atrasado ❌ (costo: pérdida reseña/cliente) |
| TP (True Positives) | 221 | Predijo atrasado → llegó atrasado ✅ |

---

## Métricas Derivadas

| Métrica | Fórmula | Valor |
|---|---|---|
| Precision | TP / (TP + FP) | 0.0635 (6.35%) |
| Recall | TP / (TP + FN) | 0.2309 (23.09%) |
| F1 | 2 * P * R / (P + R) | 0.0997 |
| FPR | FP / (FP + TN) | 24.1% |
| FNR | FN / (FN + TP) | 76.9% |

---

## Costo de cada tipo de error

### Falso Positivo (FP)
El modelo predice atraso, el pedido llega a tiempo.

**Consecuencias:**
- El seller recibe una alerta innecesaria (frustración operativa).
- Se invierte tiempo de atención al cliente sin necesidad.
- El cliente puede recibir una comunicación preocupante sin motivo real.

**Mitigación:** Con umbral más alto (mayor precision, menor recall), se reducen FPs pero se pierden más positivos reales.

### Falso Negativo (FN)
El modelo no detecta un retraso real.

**Consecuencias:**
- El pedido llega tarde sin intervención previa.
- El cliente deja reseña negativa.
- El seller pierde reputación y posiblemente un cliente recurrente.

**Mitigación:** Con umbral más bajo (mayor recall, menor precision), se detectan más retrasos pero se generan más alertas innecesarias.

---

## Análisis por Ranking (Precision@K)

| K | Pedidos seleccionados | Positivos detectados | Precision@K | Lift@K |
|---|---|---|---|---|
| Top 5% (K=723) | 723 | 72 | 9.96% | 1.506x |
| Top 10% (K=1,447) | 1,447 | 174 | 12.02% → wait, 7.95% | 1.202x |

> **Nota:** El lift en Top 5% (1.506x) supera el threshold de 1.5x, pero el modelo no supera los gates de ROC-AUC y PR-AUC global. El gate de Precision@5% no está definido en los quality gates actuales.

---

## Diagnóstico cualitativo

Con los datos disponibles, el modelo:

1. **Captura ~23% de los retrasos reales** con el threshold actual, a costa de una precision muy baja (6.35%).
2. **Detecta correctamente 221 de 957 retrasos reales** en test.
3. **Genera 3,257 falsas alarmas** por cada 221 retrasos detectados (ratio ~15:1).

Para uso operativo, este ratio de FP:TP es muy alto para justificar intervenciones automáticas. Una intervención manual revisando el top 5% de riesgo tiene mejor Precision@K.

---

## Categorías de error sugeridas para análisis futuro

Si se dispone de datos adicionales, sería valioso analizar:
- ¿Los FN concentran pedidos de rutas específicas?
- ¿Los FP concentran pedidos de sellers con historial de atraso pero que llegaron a tiempo en test?
- ¿La distribución de FN cambia por mes de compra o por seller_state?

Estos análisis requieren acceso a los predictions individuales, que se almacenan cuando prediction_status = SUCCESS.
