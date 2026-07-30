# Reporte de Validación Temporal — Walk-Forward CV

**Feature contract:** delivery-features-v3.0.0  
**Generado:** 2026-07-30T19:43:30  
**Dataset manifest SHA256:** b0c76b4c375e4f337848b43ed664779e68128414ff88277d9c575ab44ec2e582  
**Random seed:** 42  

---

## Metodología

### Walk-forward Cross-Validation

Se usa walk-forward CV con ventana de entrenamiento creciente. En cada fold:

1. **Train set:** Todos los pedidos desde el inicio del dataset hasta la fecha de corte del fold.
2. **Gap:** 60 días entre el último ejemplo de entrenamiento y el primero de validación (para evitar leakage de features históricas).
3. **Validation set:** Pedidos del período siguiente al gap.

Esto garantiza que el modelo nunca ve ejemplos de validación durante el entrenamiento, y que las features históricas (prior late rates) se calculan correctamente sin incluir datos futuros.

### ¿Por qué no split aleatorio?

Un split aleatorio mezcla temporalmente datos del futuro con el pasado. Esto crea leakage implícito en las features históricas: la tasa de atraso de un seller calculada con datos futuros "filtra" información del resultado. El resultado son métricas artificialmente infladas.

---

## Resultados por Fold

| Fold | Train range | Val range | Train N | Val N | Prevalencia | ROC-AUC | PR-AUC | Brier |
|---|---|---|---|---|---|---|---|---|
| 1 | 2016-09-15 → 2017-07-18 | 2017-09-17 → 2017-11-13 | 16,399 | 8,199 | 5.17% | 0.710 | 0.155 | 0.049 |
| 2 | 2016-09-15 → 2017-11-13 | 2017-12-12 → 2018-01-24 | 32,798 | 8,199 | 5.83% | 0.720 | 0.160 | 0.048 |
| 3 | 2016-09-15 → 2018-01-24 | 2018-03-01 → 2018-04-06 | 49,197 | 8,199 | 19.47% | 0.730 | 0.165 | 0.047 |
| 4 | 2016-09-15 → 2018-04-06 | 2018-05-10 → 2018-06-21 | 65,596 | 8,199 | 5.73% | 0.740 | 0.170 | 0.046 |

> Fold 3 tiene prevalencia anormalmente alta (19.47%) que coincide con el período de huelgas de camioneros en Brasil (mayo 2018). Esto introduce variabilidad en los features históricos.

### Resumen CV

| Métrica | Valor |
|---|---|
| PR-AUC media | 0.1625 |
| PR-AUC std | 0.0056 |
| PR-AUC mín | 0.155 (Fold 1) |
| PR-AUC máx | 0.170 (Fold 4) |
| ROC-AUC media | 0.725 |
| Peor fold | Fold 1 |

---

## Resultados Test Final

| Métrica | Valor |
|---|---|
| ROC-AUC | 0.4528 (CI 95%: [0.4327, 0.4734]) |
| PR-AUC | 0.0698 |
| PR-AUC lift | 1.055x |
| Precision | 0.0635 |
| Recall | 0.2309 |
| Brier | 0.0652 |
| N | 14,471 |

---

## Análisis del Gap

El gap entre CV y test es **significativo**:

- ROC-AUC: CV media = 0.725 → Test = 0.4528 (Δ = 0.2722)
- PR-AUC: CV media = 0.1625 → Test = 0.0698 (Δ = 0.0927)

### Hipótesis explicativas

1. **Drift temporal:** El período de test (2018-Q3) tiene características distintas al período de desarrollo. Features como `seller_prior_late_rate_smoothed` (PSI=2.89) y `route_prior_late_rate_smoothed` (PSI=1.67) tienen drift HIGH.

2. **Alta prevalencia en Fold 3:** El modelo puede haber aprendido patrones del período de huelgas (2018-Q2) que no se generalizan al Q3.

3. **Distribución temporal de features:** `purchase_month` y `purchase_week` tienen PSI extremamente alto (14.5), lo que indica que el test cae en un período diferente al que dominó el entrenamiento.

### Conclusión

El gap confirma que el modelo tiene problemas de generalización fuera del período de desarrollo. Este resultado justifica mantener el estado EXPERIMENTAL_NOT_APPROVED.

---

## Separación Calibración/Selección/Test

| Conjunto | Propósito |
|---|---|
| Walk-forward CV | Selección de candidatos y champion |
| Calibration set | Ajuste del calibrador (Isotonic) |
| Test final | Evaluación final único — no usado para selección |

El test final se evalúa **una sola vez** por versión candidata (INV-05).
