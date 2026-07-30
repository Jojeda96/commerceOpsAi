# Incident Report: Anomaly Detection Scope Mismatch & Unrequested Date Injection

**Date:** 2026-07-30  
**Scope:** Investigation Engine / Supervisor Node / Anomaly Agent  
**Severity:** P0 - Correctness & Integrity Bug  

## 1. Incident Overview

When presented with the prompt:
> "Detecta desviaciones o picos anómalos en la tasa de retraso de entregas mediante Z-Score robusto."

The system exhibited the following incorrect behaviors:
1. **Supervisor injected arbitrary dates:** Injected `dateFrom=2023-01-01` and `dateTo=2023-10-31` even though the user specified no date range and the Olist dataset spans 2016-2018.
2. **Logistics vs. Anomaly Scope Mismatch:** Logistics strictly filtered by 2023 and returned 0 deliveries (`NO_DATA`), while Anomaly ignored date filters and analyzed 2018 dataset dates.
3. **Unnecessary Agent Selection:** Selected `DATA_SCIENCE` agent despite the query asking strictly for descriptive Z-Score anomaly detection.
4. **Self-Generated Contradiction:** Critic rejected the investigation because Logistics (0 deliveries) contradicted Anomaly (found anomalies in 2018).
5. **Repeated Identical Re-iteration:** Re-execution repeated iteration `1` with identical inputs and accumulated duplicate findings.
6. **Duplicate Lifecycle Event:** `investigation.started` was emitted twice in SSE stream.
7. **False Audit Confidence:** UI stated that confiances of 92%, 93%, and 100% were "audited by Evidence Critic", despite the investigation being REJECTED.

## 2. Expected Correct Behavior

1. **Unforced Scope:** If user specifies no dates, `dateFrom` and `dateTo` MUST be `null` / `undefined`. LLMs must NOT invent date bounds.
2. **Unified Scope:** All specialists in a round MUST receive the exact same `AnalysisScope` with matching `scopeHash`.
3. **Agent Alignment:** Query mapping to `DESCRIPTIVE_LOGISTICS` + `ANOMALY_DETECTION` MUST invoke ONLY `LOGISTICS` and `ANOMALY` agents.
4. **Iteration Increments:** Re-execution must increment `iteration` to `2` and enforce fingerprint uniqueness to prevent infinite loop duplicates.
5. **Honest Confidence & SSE:** UI must display audit status as REJECTED or UNAPPROVED, and `investigation.started` must be emitted exactly once.

## 3. Preventive Rules Applied (EXEC PLAN V4.1)

- `R-01`: No inventar filtros
- `R-02`: Un scope por ronda
- `R-03`: Cero no significa ausencia
- `R-08`: No repetir una ronda idéntica
- `R-09`: Findings activos únicos
- `R-10`: Una sola emisión lógica por evento
