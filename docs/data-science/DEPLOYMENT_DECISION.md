# Decisión de Despliegue V4 — Champion xgboost_baseline

**Fecha:** 2026-07-30  
**Decisión:** EXPERIMENTAL_NOT_APPROVED  
**Responsable:** ModelGovernance (automático) + revisión V4  

---

## Contexto

El champion actual (`xgboost_baseline`) fue evaluado contra los quality gates V3 en el conjunto de test final (14,471 órdenes). Los gates son evaluados automáticamente por `ModelGovernance` en `apps/ml-service/app/services/model_governance.py`.

---

## Evaluación de Quality Gates

| Gate | Descripción | Umbral | Resultado champion | Decisión |
|---|---|---|---|---|
| ROC-AUC absoluto | Discriminación mínima | ≥ 0.60 | 0.4528 | ❌ FALLA |
| PR-AUC lift | Lift sobre prevalencia | ≥ 1.50x | 1.055x | ❌ FALLA |
| Recall mínimo | Cobertura de positivos | ≥ 0.50 | 0.2309 | ❌ FALLA |
| Precision mínima | Precisión de alertas | ≥ 0.15 | 0.0635 | ❌ FALLA |
| Supera mejor logistic | Gap relativo PR-AUC | > 0 | +0.0152 | ✅ PASA |

**Estado final:** `EXPERIMENTAL_NOT_APPROVED` — 4 de 5 gates fallados.

---

## ¿Por qué es la decisión correcta?

Bloquear un modelo que no generaliza es el resultado correcto de un proceso de gobernanza responsable. Las alternativas irresponsables serían:

1. **Bajar los thresholds de los gates** para hacer pasar al modelo artificialmente.
2. **Ignorar el gap CV/test** y desplegar basándose en métricas de validación.
3. **Usar el modelo sin comunicar las limitaciones** a los usuarios del sistema.

El estado EXPERIMENTAL_NOT_APPROVED significa que:
- El sistema de gobernanza **funciona correctamente**.
- El proyecto es **honesto** sobre las capacidades actuales del modelo.
- Las decisiones operativas automáticas **no se toman** con un modelo que no generaliza.

---

## Análisis del gap entre candidatos y test

| Modelo | PR-AUC CV | PR-AUC Test | Δ |
|---|---|---|---|
| xgboost_baseline (champion) | 0.1593 | 0.0698 | -0.0895 |
| logistic_unweighted | 0.1441 | — | — |
| logistic_balanced | 0.1382 | — | — |
| logistic_cw_1_3 | 0.1417 | — | — |

El gap en el champion es de -0.0895 en PR-AUC, lo que refleja que el período de test tiene características distribucionales distintas al período de desarrollo.

---

## Condiciones para futura aprobación

Para que un modelo candidato supere los gates, necesitaría:

1. ROC-AUC en test ≥ 0.60
2. PR-AUC lift en test ≥ 1.50x sobre prevalencia
3. Recall en test ≥ 0.50
4. Precision en test ≥ 0.15

Estrategias que podrían mejorar el desempeño:
- Features adicionales de contexto logístico (carrier, capacidad del seller)
- Reentrenamiento con datos más recientes que reduzcan el drift temporal
- Modelos con mayor capacidad de capturar interacciones no lineales entre estados y prior rates

---

## Implicaciones para el sistema

- La API responde `HTTP 503` con código `MODEL_NOT_APPROVED` cuando se solicita una predicción.
- Los agentes de Data Science no crean `ModelPrediction` cuando el modelo no está aprobado (INV-04).
- El estado se muestra honestamente en el frontend de Gobernanza ML.
- Los findings de los agentes no son bloqueados por el estado del modelo — solo las predicciones son desactivadas.
