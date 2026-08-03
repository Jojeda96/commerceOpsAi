# Partial Result & Diagnostic Policy — CommerceOps AI V4.2

## Unavailability Reason Codes

When predictive machine learning scenarios cannot be executed, CommerceOps AI returns reason-specific diagnostic codes instead of collapsing all errors into `NO_SCENARIOS_MATCH_FILTERS`:

- `SNAPSHOT_TABLE_MISSING`: PostgreSQL feature snapshot table does not exist.
- `SNAPSHOT_TABLE_EMPTY`: Feature snapshot table contains zero rows.
- `SNAPSHOT_QUERY_FAILED`: Database query error during scenario retrieval.
- `NO_ROWS_IN_SCOPE`: Snapshot table exists but no rows match active `AnalysisScope`.
- `NO_GROUP_MEETS_MINIMUM_SAMPLE`: Route/category groups exist but none reached minimum sample threshold.

In all partial cases, **Model Governance remains fully available** and status resolves to `COMPLETED_WITH_WARNINGS`.
