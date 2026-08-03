# Analytical Grounding Policy — CommerceOps AI V4.2

## Core Principles

1. **No Quantitative Prose without NumericClaims**: Every number rendered in an agent finding description must be registered in structured `numericClaims` and matched to a validated `EvidenceMetric`.
2. **Method Provenance Enforcement**: An agent may only claim analysis methods (`ROBUST_Z_SCORE`, `LOCAL_SHAP`, `STAGE_BREAKDOWN`) if evidence issued by the corresponding tool exists in the active investigation context.
3. **Scope Hash Parity**: All evidence combined in a single finding must carry identical `scopeHash` attributes.
4. **Deterministic Audit**: Evidence quality scores are calculated by a 100-point deterministic rubric rather than arbitrary LLM confidence scores.
