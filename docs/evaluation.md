# Reporte de Evaluaciones Comparativas - CommerceOps AI

> ⚠️ **Nota Metodológica:** Estos resultados forman parte de la suite sintética de prueba del framework de evaluación. No representan aún experimentos comparativos offline ejecutados sobre un dataset de prueba independiente.

## Resultados Sintéticos de Demostración del Framework

| Configuración | Exactitud Numérica | Agent Routing | Groundedness | Tasa Alucinación | Latencia Prom. |
|---|---|---|---|---|---|
| **SINGLE_AGENT** | 95.0% | 60.0% | 75.0% | 8.0% | 4500 ms |
| **MULTI_AGENT_NO_CRITIC** | 95.0% | 100.0% | 85.0% | 4.0% | 2800 ms |
| **MULTI_AGENT_WITH_CRITIC** | 95.0% | 100.0% | 95.0% | 2.0% | 2800 ms |

## Conclusión

El harness de evaluación valida el formato del reporte y la recolección de métricas. Las mediciones experimentales definitivas se generarán mediante el runner offline de evaluación (Fase 13).
