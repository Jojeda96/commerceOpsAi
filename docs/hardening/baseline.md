# Hardening Baseline — CommerceOps AI

**Commit base:** `c59312f01ad5e54187580d51d07233d1305be812`  
**Fecha:** 29 de julio de 2026

## Estado del Proyecto al Iniciar Hardening

- **Frontend:** Next.js 14 App Router (`apps/web`), Dashboard, Historial, Detalle, SSE.
- **Backend:** NestJS (`apps/api`), LangGraph orquestador, Prisma ORM con PostgreSQL.
- **Servicio ML & NLP:** FastAPI (`apps/ml-service`), XGBoost baseline para atrasos de entregas, SentenceTransformers / TF-IDF para búsqueda semántica de reseñas.
- **Tipos Compartidos:** `@commerce-ops/shared-types`, `@commerce-ops/agent-contracts`.

## Limitaciones Conocidas a Resolver (P0 / P1)

1. Trazabilidad de `AgentRun` con tokens y costos simulados.
2. `ToolExecution` asociadas indiscriminadamente por prefijo `ev-`.
3. Modelo XGBoost evaluado incorrectamente sin split Train/Val/Test y ROC-AUC < 0.5.
4. Escenario ML fijo (SP/RJ, freight_value 45) en lugar de datos reales de DB.
5. Inconsistencia entre modelo NLP e índice semántico.
6. Evaluaciones comparativas en `docs/evaluation.md` declaradas como reales cuando eran sintéticas.
7. Explicaciones ficticias de score (50/30/20) y afirmaciones causales de SHAP en el frontend.
8. Rejection / Warning handling en endpoint `/report`.
