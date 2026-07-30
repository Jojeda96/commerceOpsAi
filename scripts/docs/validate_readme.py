#!/usr/bin/env python3
"""
PR-12: Validate README.md against a set of rules:
1. No prohibited hardcoded terms (XGBoost Tuned, v1.1.0, etc.)
2. Required markdown links exist as actual files in the repo.
3. No 'localhost:8000' in README.
4. Data Science section is present.

Usage:
    python scripts/docs/validate_readme.py
"""

import sys
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
README = ROOT / "README.md"

PROHIBITED_TERMS = [
    "XGBoost Tuned",
    "v1.1.0",
    "fallback automático",
    "Heurística / ML Service",
    "XGBOOST_RAW_MARGIN",
    "localhost:8000",
]

REQUIRED_LINKS = [
    "docs/data-science/MODEL_CARD.md",
    "docs/data-science/TEMPORAL_VALIDATION_REPORT.md",
    "docs/data-science/DRIFT_ANALYSIS.md",
    "docs/data-science/ERROR_ANALYSIS.md",
    "docs/data-science/MODEL_DEFENSE_QA.md",
    "docs/engineering/INVARIANTS.md",
]


def main() -> int:
    if not README.exists():
        print("ERROR: README.md not found", file=sys.stderr)
        return 1

    content = README.read_text(encoding="utf-8")
    errors: list[str] = []

    # Check prohibited terms
    for term in PROHIBITED_TERMS:
        if term in content:
            errors.append(f"Prohibited term found in README: '{term}'")

    # Check required links exist as files
    for link_path in REQUIRED_LINKS:
        full_path = ROOT / link_path
        if not full_path.exists():
            errors.append(f"Required file referenced in README does not exist: {link_path}")

    # Check Data Science section exists
    if "data-science" not in content.lower() and "gobernanza" not in content.lower():
        errors.append("README.md is missing a Data Science / Gobernanza ML section")

    # Check Estado verificado del sistema section
    if "Estado verificado" not in content and "estado verificado" not in content.lower():
        errors.append("README.md is missing 'Estado verificado del sistema' section (required by PR-12)")

    if errors:
        print("README validation FAILED:")
        for err in errors:
            print(f"  FAIL: {err}")
        return 1

    print(f"[OK] README.md validation passed ({len(REQUIRED_LINKS)} links checked, {len(PROHIBITED_TERMS)} prohibited terms checked).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
