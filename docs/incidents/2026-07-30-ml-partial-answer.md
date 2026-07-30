# Incident Report: ML Predictive Probability, Governance, and SHAP Partial Answer Failure

**Date:** 2026-07-30  
**Scope:** Data Science Agent / Model Scenarios / Model Governance / Evidence Critic  
**Severity:** P0 - Model Integrity & Auditable Partial Results Bug  

## 1. Incident Overview

When presented with the prompt:
> "¿Cuál es la probabilidad predictiva de atraso en envíos interestatales, el estado de gobernanza del modelo y los factores SHAP de mayor impacto?"

The system exhibited the following incorrect behaviors:
1. **Historical Rate Mislabeled as Prediction:** Logistics presented historical late delivery rates (e.g. 35.3% for PR->RJ) as if they answered the predictive probability question.
2. **All-or-Nothing Data Science Abandonment:** When Data Science failed to find valid scenario feature snapshots (`NO_SCENARIOS_MATCH_FILTERS`), it abandoned the entire node response instead of returning model governance.
3. **Governance Omission:** Governance status was not returned even though model governance queries do not depend on scenario discovery.
4. **Unjustified SHAP Request:** System did not explain that SHAP local explanations cannot be computed without a valid prediction score.
5. **100% Confidence for Technical Unavailability:** Unavailability states (`NO_SCENARIOS_MATCH_FILTERS`) were displayed in UI with "100% Confidence".
6. **Blocked Finding Lacked Technical Evidence:** Findings flagged as BLOCKED had empty `evidenceIds: []`.
7. **Critic Rejected Honest Failure:** Critic treated technical unavailability as an unjustified missing evidence failure instead of approving a valid partial result with warnings (`APPROVED_WITH_WARNINGS`).

## 2. Expected Correct Behavior

1. **Independent Capabilities:** Data Science MUST separate Governance, Scenario Discovery, Prediction, and Local Explanation into independent tool calls and response components.
2. **Partial Result Delivery:** If no scenarios match, Data Science MUST return Governance state (`AVAILABLE`) and explicitly declare Prediction and Local Explanation as `UNAVAILABLE_WITH_REASON`.
3. **SHAP Pre-conditions:** Local SHAP explanations must ONLY be invoked if a valid scenario prediction exists.
4. **Historical vs Predictive Separation:** Historical delivery rates MUST NEVER populate predictive probability fields.
5. **Auditable Unavailability Semantics:** Unavailability must be recorded as `UNAVAILABLE` status with `NOT_APPLICABLE` confidence details, not 100%.
6. **Critic Partial Approval:** Critic must approve with warnings (`APPROVED_WITH_WARNINGS`) when answered components are supported by evidence and unavailable components are honestly documented.

## 3. Preventive Rules Applied (EXEC PLAN V4.1)

- `R-04`: Indisponibilidad no tiene confianza predictiva
- `R-05`: Histórico y predictivo son conceptos distintos
- `R-06`: Gobernanza es independiente del escenario
- `R-07`: SHAP requiere predicción
- `R-09`: Findings activos únicos
