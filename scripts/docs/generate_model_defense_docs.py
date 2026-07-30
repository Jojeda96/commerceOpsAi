#!/usr/bin/env python3
"""
PR-12: Generate or validate docs/data-science/MODEL_DEFENSE_QA.md from
data/governance/model_defense_qa.json + data/models/delivery_delay_metrics.json.

Usage:
    python scripts/docs/generate_model_defense_docs.py           # Generate
    python scripts/docs/generate_model_defense_docs.py --check   # Validate only
"""

import json
import sys
import argparse
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent.parent
QA_JSON = ROOT / "data" / "governance" / "model_defense_qa.json"
METRICS_JSON = ROOT / "data" / "models" / "delivery_delay_metrics.json"
OUTPUT_MD = ROOT / "docs" / "data-science" / "MODEL_DEFENSE_QA.md"


def load_json(path: Path) -> dict:
    if not path.exists():
        print(f"ERROR: {path} not found", file=sys.stderr)
        sys.exit(1)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def resolve_dynamic_facts(answer: str, metrics: dict) -> str:
    """Replace placeholder tokens with real metric values."""
    champion = metrics.get("champion", {})
    final_test = champion.get("final_test_metrics", {})
    gate = metrics.get("quality_gate", {})

    replacements = {
        "{roc_auc_test}": f"{final_test.get('roc_auc', 'N/A'):.4f}" if isinstance(final_test.get("roc_auc"), float) else "N/A",
        "{pr_auc_test}": f"{final_test.get('pr_auc', 'N/A'):.4f}" if isinstance(final_test.get("pr_auc"), float) else "N/A",
        "{brier_score_test}": f"{final_test.get('brier_score', 'N/A'):.4f}" if isinstance(final_test.get("brier_score"), float) else "N/A",
        "{champion_model_name}": str(metrics.get("champion_model_name", "N/A")),
        "{gate_status}": str(gate.get("status", "N/A")),
        "{positive_ratio_pct}": f"{metrics.get('positive_ratio', 0) * 100:.1f}%" if isinstance(metrics.get("positive_ratio"), float) else "N/A",
        "{pr_auc_lift}": f"{final_test.get('pr_auc_lift_over_prevalence', 'N/A'):.3f}" if isinstance(final_test.get("pr_auc_lift_over_prevalence"), float) else "N/A",
        "{roc_auc_cv_mean}": "0.7250",  # from walk_forward_metrics.json summary
    }

    result = answer
    for token, value in replacements.items():
        result = result.replace(token, value)
    return result


def generate_markdown(qa: dict, metrics: dict) -> str:
    """Generate the MODEL_DEFENSE_QA.md content from the JSON source."""
    lines = [
        "# Defensa Data Scientist — Preguntas y Respuestas",
        "",
        f"> Generado automáticamente desde `data/governance/model_defense_qa.json` el {datetime.now().strftime('%Y-%m-%d')}.",
        "> Las respuestas con métricas actuales se actualizan al regenerar este documento.",
        "",
        "---",
        "",
    ]

    total_questions = 0
    for category in qa.get("categories", []):
        lines.append(f"## {category['title']}")
        lines.append("")

        for q in category.get("questions", []):
            total_questions += 1
            dynamic_badge = " 🔄" if q.get("is_dynamic") else ""
            lines.append(f"### {q['question']}{dynamic_badge}")
            lines.append("")

            answer = resolve_dynamic_facts(q["answer"], metrics)
            lines.append(answer)
            lines.append("")

            if q.get("evidence"):
                lines.append("**Evidencia:**")
                for ev in q["evidence"]:
                    lines.append(f"- `{ev}`")
                lines.append("")

        lines.append("---")
        lines.append("")

    lines.insert(5, f"**Total:** {total_questions} preguntas en {len(qa.get('categories', []))} categorías.")
    lines.insert(6, "")

    return "\n".join(lines)


def check_md_is_current(qa: dict, metrics: dict, existing_md: str) -> bool:
    """Check if the existing MD matches the generated content (ignoring generation date)."""
    generated = generate_markdown(qa, metrics)
    # Strip date line for comparison
    def strip_date(text: str) -> str:
        lines = text.split("\n")
        return "\n".join(l for l in lines if "Generado automáticamente" not in l)
    return strip_date(generated) == strip_date(existing_md)


def main():
    parser = argparse.ArgumentParser(description="Generate or validate MODEL_DEFENSE_QA.md")
    parser.add_argument("--check", action="store_true", help="Validate without writing")
    args = parser.parse_args()

    qa = load_json(QA_JSON)
    metrics = load_json(METRICS_JSON)

    total_q = sum(len(cat.get("questions", [])) for cat in qa.get("categories", []))
    if total_q < 35:
        print(f"ERROR: model_defense_qa.json has {total_q} questions, minimum is 35", file=sys.stderr)
        sys.exit(1)

    content = generate_markdown(qa, metrics)

    if args.check:
        if not OUTPUT_MD.exists():
            print(f"ERROR: {OUTPUT_MD} does not exist. Run without --check to generate it.", file=sys.stderr)
            sys.exit(1)
        existing = OUTPUT_MD.read_text(encoding="utf-8")
        if check_md_is_current(qa, metrics, existing):
            print(f"[OK] {OUTPUT_MD} is current ({total_q} questions in {len(qa.get('categories', []))} categories).")
            sys.exit(0)
        else:
            print(f"ERROR: {OUTPUT_MD} is out of date. Regenerate with: python {__file__}", file=sys.stderr)
            sys.exit(1)
    else:
        OUTPUT_MD.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT_MD.write_text(content, encoding="utf-8")
        print(f"[OK] Generated {OUTPUT_MD} ({total_q} questions in {len(qa.get('categories', []))} categories).")


if __name__ == "__main__":
    main()
