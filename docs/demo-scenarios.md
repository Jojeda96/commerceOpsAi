# Escenarios Demo Reproducibles — CommerceOps AI

## Escenario 1: Caída de Satisfacción de Clientes
- **Pregunta:** `¿Por qué disminuyó la calificación promedio durante febrero de 2018?`
- **Agentes invocados:** `LOGISTICS`, `CUSTOMER_EXPERIENCE`, `SALES`, `CRITIC`, `STRATEGY`
- **Resultado esperado:** Identificación del incremento en la tasa de atrasos y correlación con comentarios negativos.

## Escenario 2: Aumento de Atrasos por Categoría
- **Pregunta:** `¿Qué está provocando el aumento de entregas atrasadas en la categoría muebles?`
- **Agentes invocados:** `LOGISTICS`, `SELLER_PERFORMANCE`, `ANOMALY`, `CRITIC`
- **Resultado esperado:** Detección de tiempos excesivos de procesamiento por parte del vendedor y rutas interestatales críticas.

## Escenario 3: Evaluación de Riesgo de Vendedor
- **Pregunta:** `Evalúa el riesgo operacional y rendimiento acumulado del vendedor principal.`
- **Agentes invocados:** `SELLER_PERFORMANCE`, `LOGISTICS`, `CUSTOMER_EXPERIENCE`, `STRATEGY`
- **Resultado esperado:** Scorecard completo con clasificación de riesgo (HIGH/LOW) y recomendaciones de auditoría.

## Escenario 4: Predicción con Machine Learning
- **Pregunta:** `¿Qué pedidos interestatales tienen mayor probabilidad de llegar tarde?`
- **Agentes invocados:** `DATA_SCIENCE`, `LOGISTICS`, `STRATEGY`
- **Resultado esperado:** Ejecución del modelo XGBoost con desglose de contribución SHAP por variable.
