# V4 Release Audit — CommerceOps AI

**Fecha:** 2026-07-30  
**SHA base:** `3d6f541b7b92d1221f6be5bdd9c6c76e5ca02606`  
**Estado:** AUDITADO — V4 COMPLETO  

---

## Criterio de release

V4 puede etiquetarse si:

```
all_required_checks = PASS
```

Nota: No es requisito que el modelo sea aprobado. Sí es requisito que el estado experimental sea consistente, explicado y bloqueado.

---

## Checklist por categoría

### Contratos

- [x] Feature contract coincide con bundle — `delivery-features-v3.0.0`
- [x] Pydantic rechaza faltantes y extras — `extra="forbid"`, strict mode
- [x] TypeScript envía todos los campos — `ds.tools.ts` con Zod schema V3
- [x] Request y response examples verificados

### Data Science

- [x] Snapshots point-in-time — `DeliveryFeatureSnapshot` en Prisma
- [x] No carrier/delivery date como input — validado en contrato V3 e INVARIANTS.md
- [x] Walk-forward CV report — `data/models/reports/walk_forward_metrics.json`
- [x] Drift report — `data/models/reports/drift_report.json`
- [x] Ablation report — `data/models/reports/ablation_report.json`
- [x] Calibration separada — `data/models/reports/calibration_report.json`
- [x] Champion decision reproducible — `data/models/reports/champion_decision.json`
- [x] Test final no usado para selección — INV-05 implementado

### Runtime

- [x] Champion path único — `delivery_delay_champion.joblib` como DELIVERY_MODEL_BUNDLE_PATH
- [x] Model adapter correcto — `ModelAdapter` factory para TREE/LINEAR
- [x] No defaults silenciosos — eliminados `"SP"`, `"RJ"`, `"beleza_saude"`, `500.0`, `4500.0`
- [x] Unavailable no produce prediction — INV-04 implementado en `ds.node.ts`

### Governance

- [x] Gate absoluto — ROC-AUC ≥ 0.60, PR-AUC lift ≥ 1.5x, Recall ≥ 0.50, Precision ≥ 0.15
- [x] Gate relativo — champion > best logistic en PR-AUC
- [x] Strategy excluye bloqueados — estrategia solo se ejecuta con findings accionables
- [x] Critic valida claims numéricos — `auditNumericClaims` en deterministic-audit.ts

### Observabilidad

- [x] Todos los nodos tienen AgentRun — `PrismaTraceSinkService` + agent-runner.ts
- [x] Fallos persistidos — trazabilidad durable incluso en excepciones
- [x] Tool executions vinculadas — ToolExecution → AgentRun FK
- [x] Findings sin run rechazados — validación en orchestrator

### Persistencia

- [x] Migration deploy en DB vacía — `prisma migrate deploy`
- [x] No drift Prisma — schema.prisma sincronizado
- [x] Operational status persistido — `operationalStatus` en Investigation
- [x] localRunId y localExecutionId en AgentRun
- [x] Required actions persistidas

### NLP y Health

- [x] Manifest coherente — NLP service valida manifest al cargar
- [x] Sin fallback oculto — HTTP 503 cuando recursos NLP no disponibles
- [x] Redis ping real — health check en `/api/health`

### Frontend

- [x] Sin `localhost:8000` — eliminado en ml-governance/page.tsx
- [x] Champion genérico — no hay `XGBoost Tuned` hardcodeado en JSX
- [x] Folds y drift visibles — TemporalValidation y DriftPanel implementados
- [x] Defensa DS visible — DataScientistDefense con 40 Q&A
- [x] Estados unavailable honestos — error state muestra UNAVAILABLE sin métricas ficticias

### CI

- [x] Sin `|| true` — INV-08 implementado
- [x] Sin `continue-on-error: true`
- [x] Lint verde
- [x] Builds verdes
- [x] Unit tests verdes
- [x] Migration test verde
- [x] Docker build verde

### Documentación

- [x] README validado — `scripts/docs/validate_readme.py` pasa
- [x] Model Card actualizado — `docs/data-science/MODEL_CARD.md`
- [x] Defense Q&A generado — `docs/data-science/MODEL_DEFENSE_QA.md` (40 preguntas en 11 categorías)
- [x] Métricas del README no se hardcodean — tabla de capacidades con estados verificados
- [x] INVARIANTS.md — 8 invariantes documentados
- [x] V4_BASELINE.md — SHA y checksums congelados

---

## Comandos de verificación final

```bash
# Contratos
PYTHONPATH=. pytest tests/contracts -q
python scripts/contracts/validate_delivery_contract.py

# ML y Data Science
PYTHONPATH=. pytest tests/ml apps/ml-service/tests -q

# Documentación
python scripts/docs/generate_model_defense_docs.py --check
python scripts/docs/validate_readme.py

# Release audit completo
python scripts/release/verify_v4.py
```

---

## Estado del modelo al cierre V4

| Campo | Valor |
|---|---|
| Champion | xgboost_baseline |
| Deployment status | EXPERIMENTAL_NOT_APPROVED |
| ROC-AUC test | 0.4528 |
| PR-AUC test | 0.0698 |
| Gate status | EXPERIMENTAL_NOT_APPROVED |
| Feature contract | delivery-features-v3.0.0 |
| Bundle schema | 3.0 |

> El modelo experimental bloqueado es el resultado honesto del proceso de gobernanza. V4 documenta por qué está bloqueado y qué sería necesario para aprobarlo.
