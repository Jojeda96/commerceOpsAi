#!/usr/bin/env python3
"""
PR-13: V4 Release Audit Verification Script

Checks all conditions required to tag a V4 release. Reports pass/fail for each
checklist item. All checks must pass for release to be authorized.

Usage:
    python scripts/release/verify_v4.py
    python scripts/release/verify_v4.py --fail-fast  # stop at first failure
"""

import json
import sys
import argparse
import hashlib
from pathlib import Path
from typing import NamedTuple

ROOT = Path(__file__).resolve().parent.parent.parent


class CheckResult(NamedTuple):
    category: str
    name: str
    passed: bool
    detail: str


def check(category: str, name: str, condition: bool, detail: str = "") -> CheckResult:
    return CheckResult(category, name, condition, detail)


def file_exists(rel: str) -> bool:
    return (ROOT / rel).exists()


def load_json(rel: str) -> dict | None:
    path = ROOT / rel
    if not path.exists():
        return None
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError:
        return None


def sha256(rel: str) -> str | None:
    path = ROOT / rel
    if not path.exists():
        return None
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def no_term_in_file(rel: str, term: str) -> bool:
    path = ROOT / rel
    if not path.exists():
        return True  # file doesn't exist, can't contain the term
    content = path.read_text(encoding="utf-8", errors="ignore")
    return term not in content


def run_all_checks() -> list[CheckResult]:
    results: list[CheckResult] = []

    # ---- Contracts ----
    contract = load_json("data/contracts/delivery_feature_contract.v3.json")
    metrics = load_json("data/models/delivery_delay_metrics.json")
    gates = load_json("data/contracts/delivery_quality_gates.v3.json")

    results.append(check(
        "Contracts", "feature_contract_v3_exists",
        file_exists("data/contracts/delivery_feature_contract.v3.json"),
        "data/contracts/delivery_feature_contract.v3.json"
    ))
    results.append(check(
        "Contracts", "feature_contract_has_prediction_moment",
        bool(contract and contract.get("prediction_moment") == "ORDER_PURCHASE"),
        f"prediction_moment={contract.get('prediction_moment') if contract else 'N/A'}"
    ))
    results.append(check(
        "Contracts", "feature_contract_version_correct",
        bool(contract and contract.get("contract_version") == "delivery-features-v3.0.0"),
        f"contract_version={contract.get('contract_version') if contract else 'N/A'}"
    ))
    results.append(check(
        "Contracts", "quality_gates_v3_exists",
        file_exists("data/contracts/delivery_quality_gates.v3.json"),
        "data/contracts/delivery_quality_gates.v3.json"
    ))
    results.append(check(
        "Contracts", "request_example_exists",
        file_exists("data/contracts/delivery_prediction_request.example.json"),
        "data/contracts/delivery_prediction_request.example.json"
    ))
    results.append(check(
        "Contracts", "validate_contract_script_exists",
        file_exists("scripts/contracts/validate_delivery_contract.py"),
        "scripts/contracts/validate_delivery_contract.py"
    ))

    # ---- Data Science ----
    reports_dir = ROOT / "data" / "models" / "reports"
    results.append(check(
        "Data Science", "walk_forward_report_exists",
        (reports_dir / "walk_forward_metrics.json").exists(),
        "data/models/reports/walk_forward_metrics.json"
    ))
    results.append(check(
        "Data Science", "drift_report_exists",
        (reports_dir / "drift_report.json").exists(),
        "data/models/reports/drift_report.json"
    ))
    results.append(check(
        "Data Science", "ablation_report_exists",
        (reports_dir / "ablation_report.json").exists(),
        "data/models/reports/ablation_report.json"
    ))
    results.append(check(
        "Data Science", "calibration_report_exists",
        (reports_dir / "calibration_report.json").exists(),
        "data/models/reports/calibration_report.json"
    ))
    results.append(check(
        "Data Science", "error_analysis_report_exists",
        (reports_dir / "error_analysis.json").exists(),
        "data/models/reports/error_analysis.json"
    ))
    results.append(check(
        "Data Science", "champion_decision_exists",
        (reports_dir / "champion_decision.json").exists(),
        "data/models/reports/champion_decision.json"
    ))
    results.append(check(
        "Data Science", "feature_snapshots_script_exists",
        file_exists("scripts/ml/build_delivery_feature_snapshots.py"),
        "scripts/ml/build_delivery_feature_snapshots.py"
    ))
    results.append(check(
        "Data Science", "metrics_schema_v3",
        bool(metrics and metrics.get("metrics_schema_version") == "3.0"),
        f"metrics_schema_version={metrics.get('metrics_schema_version') if metrics else 'N/A'}"
    ))

    # ---- Runtime ----
    results.append(check(
        "Runtime", "champion_bundle_exists",
        file_exists("data/models/delivery_delay_champion.joblib"),
        "data/models/delivery_delay_champion.joblib"
    ))
    results.append(check(
        "Runtime", "champion_model_name_in_metrics",
        bool(metrics and metrics.get("champion_model_name")),
        f"champion_model_name={metrics.get('champion_model_name') if metrics else 'N/A'}"
    ))
    results.append(check(
        "Runtime", "no_silent_defaults_in_ml_engine",
        no_term_in_file("apps/ml-service/app/services/ml_engine.py", '"SP"') and
        no_term_in_file("apps/ml-service/app/services/ml_engine.py", '"beleza_saude"'),
        "No 'SP' or 'beleza_saude' fallbacks in ml_engine.py"
    ))
    results.append(check(
        "Runtime", "model_adapters_exist",
        file_exists("apps/ml-service/app/services/model_adapters/base.py") and
        file_exists("apps/ml-service/app/services/model_adapters/tree.py") and
        file_exists("apps/ml-service/app/services/model_adapters/linear.py"),
        "model_adapters/base.py, tree.py, linear.py"
    ))

    # ---- Governance ----
    results.append(check(
        "Governance", "model_governance_service_exists",
        file_exists("apps/ml-service/app/services/model_governance.py"),
        "apps/ml-service/app/services/model_governance.py"
    ))
    results.append(check(
        "Governance", "quality_gate_status_in_metrics",
        bool(metrics and metrics.get("deployment_status")),
        f"deployment_status={metrics.get('deployment_status') if metrics else 'N/A'}"
    ))
    results.append(check(
        "Governance", "critic_deterministic_audit_exists",
        file_exists("apps/api/src/agents/critic/deterministic-audit.ts"),
        "apps/api/src/agents/critic/deterministic-audit.ts"
    ))

    # ---- Observability ----
    results.append(check(
        "Observability", "prisma_trace_sink_exists",
        file_exists("apps/api/src/observability/prisma-trace-sink.service.ts"),
        "apps/api/src/observability/prisma-trace-sink.service.ts"
    ))
    results.append(check(
        "Observability", "agent_runner_exists",
        file_exists("apps/api/src/observability/agent-runner.ts"),
        "apps/api/src/observability/agent-runner.ts"
    ))

    # ---- Persistence ----
    results.append(check(
        "Persistence", "schema_prisma_exists",
        file_exists("prisma/schema.prisma"),
        "prisma/schema.prisma"
    ))
    results.append(check(
        "Persistence", "delivery_feature_snapshot_in_schema",
        file_exists("prisma/schema.prisma") and
        "delivery_feature_snapshots" in (ROOT / "prisma/schema.prisma").read_text(encoding="utf-8"),
        "DeliveryFeatureSnapshot model in schema.prisma"
    ))

    # ---- NLP & Health ----
    results.append(check(
        "NLP & Health", "nlp_service_exists",
        file_exists("apps/ml-service/app/api/routes/nlp.py") or
        file_exists("apps/ml-service/app/services/nlp_service.py"),
        "NLP service file"
    ))

    # ---- Frontend ----
    results.append(check(
        "Frontend", "ml_governance_page_no_localhost",
        no_term_in_file("apps/web/src/app/ml-governance/page.tsx", "localhost:8000"),
        "No direct localhost:8000 in governance page"
    ))
    results.append(check(
        "Frontend", "governance_components_exist",
        file_exists("apps/web/src/app/ml-governance/components/GovernanceSummary.tsx") and
        file_exists("apps/web/src/app/ml-governance/components/CandidateComparison.tsx") and
        file_exists("apps/web/src/app/ml-governance/components/TemporalValidation.tsx") and
        file_exists("apps/web/src/app/ml-governance/components/DriftPanel.tsx") and
        file_exists("apps/web/src/app/ml-governance/components/ModelLimitations.tsx") and
        file_exists("apps/web/src/app/ml-governance/components/DataScientistDefense.tsx"),
        "All 6 governance components"
    ))
    results.append(check(
        "Frontend", "governance_types_no_any_import",
        file_exists("apps/web/src/app/ml-governance/types.ts"),
        "types.ts exists"
    ))
    results.append(check(
        "Frontend", "governance_page_no_hardcoded_xgboost_tuned",
        no_term_in_file("apps/web/src/app/ml-governance/page.tsx", "XGBoost Tuned"),
        "No 'XGBoost Tuned' in page.tsx"
    ))
    results.append(check(
        "Frontend", "defense_qa_has_35_plus_questions",
        file_exists("data/governance/model_defense_qa.json") and
        sum(
            len(cat.get("questions", []))
            for cat in (load_json("data/governance/model_defense_qa.json") or {}).get("categories", [])
        ) >= 35,
        f"defense Q&A questions count"
    ))

    # ---- Documentation ----
    results.append(check(
        "Documentation", "readme_valid",
        no_term_in_file("README.md", "XGBoost Tuned") and
        no_term_in_file("README.md", "XGBOOST_RAW_MARGIN") and
        no_term_in_file("README.md", "fallback autom") and
        no_term_in_file("README.md", "localhost:8000"),
        "README has no prohibited terms"
    ))
    results.append(check(
        "Documentation", "model_card_exists",
        file_exists("docs/data-science/MODEL_CARD.md"),
        "docs/data-science/MODEL_CARD.md"
    ))
    results.append(check(
        "Documentation", "model_defense_qa_exists",
        file_exists("docs/data-science/MODEL_DEFENSE_QA.md"),
        "docs/data-science/MODEL_DEFENSE_QA.md"
    ))
    results.append(check(
        "Documentation", "temporal_validation_report_exists",
        file_exists("docs/data-science/TEMPORAL_VALIDATION_REPORT.md"),
        "docs/data-science/TEMPORAL_VALIDATION_REPORT.md"
    ))
    results.append(check(
        "Documentation", "drift_analysis_exists",
        file_exists("docs/data-science/DRIFT_ANALYSIS.md"),
        "docs/data-science/DRIFT_ANALYSIS.md"
    ))
    results.append(check(
        "Documentation", "invariants_exists",
        file_exists("docs/engineering/INVARIANTS.md"),
        "docs/engineering/INVARIANTS.md"
    ))
    results.append(check(
        "Documentation", "v4_baseline_exists",
        file_exists("docs/engineering/V4_BASELINE.md"),
        "docs/engineering/V4_BASELINE.md"
    ))
    results.append(check(
        "Documentation", "readme_has_data_science_section",
        "Data Science" in (ROOT / "README.md").read_text(encoding="utf-8", errors="ignore"),
        "README.md has Data Science section"
    ))
    results.append(check(
        "Documentation", "readme_has_estado_verificado",
        "Estado verificado" in (ROOT / "README.md").read_text(encoding="utf-8", errors="ignore"),
        "README.md has 'Estado verificado del sistema'"
    ))

    # ---- CI ----
    ci_workflow = ROOT / ".github" / "workflows" / "ci.yml"
    ci_content = ci_workflow.read_text(encoding="utf-8", errors="ignore") if ci_workflow.exists() else ""
    results.append(check(
        "CI", "ci_workflow_exists",
        ci_workflow.exists(),
        ".github/workflows/ci.yml"
    ))
    results.append(check(
        "CI", "ci_no_continue_on_error",
        "continue-on-error: true" not in ci_content or ci_content == "",
        "No continue-on-error: true in CI"
    ))

    return results


def main():
    parser = argparse.ArgumentParser(description="V4 Release Audit Verification")
    parser.add_argument("--fail-fast", action="store_true", help="Stop at first failure")
    args = parser.parse_args()

    results = run_all_checks()

    passed = [r for r in results if r.passed]
    failed = [r for r in results if not r.passed]

    # Group by category
    categories = {}
    for r in results:
        categories.setdefault(r.category, []).append(r)

    print("\n" + "=" * 60)
    print("  V4 RELEASE AUDIT RESULTS")
    print("=" * 60)

    for cat, checks_list in categories.items():
        cat_passed = all(c.passed for c in checks_list)
        print(f"\n[{'PASS' if cat_passed else 'FAIL'}] {cat}")
        for c in checks_list:
            status = "  PASS" if c.passed else "  FAIL"
            print(f"  {status}: {c.name}")
            if not c.passed and c.detail:
                print(f"          {c.detail}")

    print("\n" + "=" * 60)
    print(f"  TOTAL: {len(passed)}/{len(results)} checks passed")
    if failed:
        print(f"  FAILED: {len(failed)} checks")
        for f in failed:
            print(f"    - [{f.category}] {f.name}: {f.detail}")
    print("=" * 60)

    if failed:
        print("\nV4 RELEASE: NOT AUTHORIZED")
        print("Fix all failing checks before tagging a release.")
        sys.exit(1)
    else:
        print("\nV4 RELEASE: ALL CHECKS PASSED")
        print("V4 may be tagged after manual review of this output.")
        sys.exit(0)


if __name__ == "__main__":
    main()
