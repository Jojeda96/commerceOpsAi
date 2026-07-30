# 🧠 Data Science — CommerceOps AI

Este directorio contiene la documentación técnica del predictor de atrasos de entrega. Los documentos son generados o validados contra artefactos reales del modelo.

## Índice

| Documento | Propósito |
|---|---|
| [MODEL_CARD.md](MODEL_CARD.md) | Descripción completa del modelo, decisiones y riesgos |
| [PROBLEM_DEFINITION.md](PROBLEM_DEFINITION.md) | Definición del problema y formulación ML |
| [TEMPORAL_VALIDATION_REPORT.md](TEMPORAL_VALIDATION_REPORT.md) | Walk-forward CV y análisis del gap validación/test |
| [DRIFT_ANALYSIS.md](DRIFT_ANALYSIS.md) | Análisis de drift de features entre entrenamiento y test |
| [ERROR_ANALYSIS.md](ERROR_ANALYSIS.md) | Análisis de falsos positivos y falsos negativos |
| [ABLATION_REPORT.md](ABLATION_REPORT.md) | Ablation study y contribución de grupos de features |
| [REPRODUCIBILITY.md](REPRODUCIBILITY.md) | Instrucciones para reproducir los resultados |
| [DEPLOYMENT_DECISION.md](DEPLOYMENT_DECISION.md) | Decisión de despliegue y quality gate |
| [MODEL_DEFENSE_QA.md](MODEL_DEFENSE_QA.md) | Preguntas y respuestas para defensa técnica |

## Estado del modelo

> El predictor de atrasos está en estado **EXPERIMENTAL_NOT_APPROVED**. No está autorizado para decisiones operativas automáticas. El frontend interactivo de defensa está disponible en **Dashboard → Gobernanza ML → Defensa Data Scientist**.

## Nota de honestidad

La documentación no oculta limitaciones. Los documentos describen por qué el modelo fue bloqueado, qué evidencia respalda cada decisión y qué sería necesario para aprobarlo.
