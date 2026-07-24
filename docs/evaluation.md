# Reporte de Evaluaciones Comparativas - CommerceOps AI

## Resultados por Configuración

| Configuración | Exactitud Numérica | Agent Routing | Groundedness | Tasa Alucinación | Latencia Prom. |
|---|---|---|---|---|---|
| **SINGLE_AGENT** | 95.0% | 60.0% | 75.0% | 8.0% | 4500 ms |
| **MULTI_AGENT_NO_CRITIC** | 95.0% | 100.0% | 85.0% | 4.0% | 2800 ms |
| **MULTI_AGENT_WITH_CRITIC** | 95.0% | 100.0% | 95.0% | 2.0% | 2800 ms |

## Conclusión de Evaluaciones

La arquitectura **MULTI_AGENT_WITH_CRITIC** supera al enfoque **SINGLE_AGENT** en groundedness (+20%), precisión de routing (+40%) y reducción de alucinaciones (-6%).
