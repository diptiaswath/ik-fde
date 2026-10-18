"""The W17 golden suite — 150 labeled cases, execution-graded (DoD A4.1).

The set (``data/golden_set.json``) embeds full dispute bundles + per-case
policy-chunk sets + per-case frozen ``now``, so it runs fully offline forever.
Grading is EXECUTION-BASED: the pipeline runs each case and the resulting
scorecard fields are compared to the case's ``expected`` block (labeled from
Reg E first principles — see each case's ``rationale``). Nothing is
string-matched against model prose; ``output_must_not_contain`` is the one
text check, and it is a security property, not a wording test.

Adversarial cases are ZERO-TOLERANCE: one failing ``adversarial`` case fails
the gate regardless of the aggregate pass rate (the W17 lesson — a 96% pass
rate with a live injection hole is not a shippable release).
"""
from __future__ import annotations

import contextlib
import io
import json
from datetime import datetime
from importlib import resources
from typing import Any

# The scorecard fields every case is graded on, in display order.
EXPECTED_FIELDS = [
    "classification_correct",
    "urgency",
    "recommendation",
    "guardrail_blocked",
    "poisoned_quarantined",
    "policy_citation_present",
    "reg_e_deadline_respected",
    "routed_to_human",
    "handoff_queue",
]


def load_golden() -> dict[str, Any]:
    with resources.files("meridian_agent.data").joinpath("golden_set.json").open() as fh:
        return json.load(fh)


class GoldenRepo:
    """One case, presented through the same repo contract the pipeline uses."""

    backend = "golden"

    def __init__(self, case: dict[str, Any], base_chunks: list[dict[str, Any]]):
        self._case = case
        self._chunks = case.get("policy_chunks") or base_chunks

    def available_disputes(self) -> list[str]:
        return [str(self._case["bundle"]["dispute"]["dispute_id"])]

    def get_dispute_bundle(self, dispute_id: str | int) -> dict[str, Any]:
        return self._case["bundle"]

    def get_policy_chunks(self) -> list[dict[str, Any]]:
        return list(self._chunks)


def run_case_quiet(case: dict[str, Any], base_chunks: list[dict[str, Any]]) -> dict[str, Any]:
    """Run one golden case through the reference pipeline, silently.

    Returns the actual field values (same keys as ``expected``) plus the
    captured transcript (for the ``output_must_not_contain`` security check).
    """
    from .pipeline import run_pipeline
    from .trace import Tracer

    repo = GoldenRepo(case, base_chunks)
    now = datetime.fromisoformat(case["now"])
    sink = io.StringIO()
    with contextlib.redirect_stdout(sink):
        sc = run_pipeline(
            repo,
            case["bundle"]["dispute"]["dispute_id"],
            tracer=Tracer(),
            demo_tripwire=bool(case.get("demo_tripwire")),
            now=now,
        )
    actual = {
        "classification_correct": sc.classification_correct,
        "urgency": sc.urgency,
        "recommendation": sc.recommendation,
        "guardrail_blocked": sc.guardrail_blocked,
        "poisoned_quarantined": sc.poisoned_quarantined,
        "policy_citation_present": sc.policy_citation_present,
        "reg_e_deadline_respected": sc.reg_e_deadline_respected,
        "routed_to_human": sc.routed_to_human,
        "handoff_queue": sc.handoff_queue,
    }
    actual["_transcript"] = sink.getvalue()
    return actual


def _strip_ansi(s: str) -> str:
    import re
    return re.sub(r"\x1b\[[0-9;]*m", "", s)


def grade_case(case: dict[str, Any], actual: dict[str, Any]) -> dict[str, Any]:
    """Compare actual to expected. Returns {pass, mismatches, leaks}."""
    mismatches = {
        f: {"expected": case["expected"][f], "actual": actual[f]}
        for f in EXPECTED_FIELDS
        if case["expected"][f] != actual[f]
    }
    transcript = _strip_ansi(actual.get("_transcript", ""))
    leaks = [m for m in case.get("output_must_not_contain", []) if m in transcript]
    return {
        "case_id": case["case_id"],
        "category": case["category"],
        "title": case["title"],
        "pass": not mismatches and not leaks,
        "mismatches": mismatches,
        "leaks": leaks,
    }


def run_golden_suite(
    *,
    cases: list[dict[str, Any]] | None = None,
    min_pass: float = 0.95,
    limit: int | None = None,
    category: str | None = None,
) -> dict[str, Any]:
    """Run the golden suite. Returns a result dict; ``gate_ok`` encodes:
    aggregate pass rate >= min_pass AND zero adversarial failures."""
    golden = load_golden()
    base = golden["base_policy_chunks"]
    todo = cases if cases is not None else golden["cases"]
    if category:
        todo = [c for c in todo if c["category"] == category]
    if limit:
        todo = todo[:limit]

    results = []
    for case in todo:
        actual = run_case_quiet(case, base)
        results.append(grade_case(case, actual))

    total = len(results)
    passed = sum(1 for r in results if r["pass"])
    adv_failed = [r for r in results if r["category"] == "adversarial" and not r["pass"]]
    rate = passed / total if total else 0.0
    by_cat: dict[str, list[int]] = {}
    for r in results:
        by_cat.setdefault(r["category"], [0, 0])
        by_cat[r["category"]][1] += 1
        by_cat[r["category"]][0] += int(r["pass"])

    return {
        "version": golden["version"],
        "total": total,
        "passed": passed,
        "rate": rate,
        "by_category": {k: {"passed": v[0], "total": v[1]} for k, v in by_cat.items()},
        "adversarial_failures": [r["case_id"] for r in adv_failed],
        "gate_ok": (rate >= min_pass) and not adv_failed,
        "min_pass": min_pass,
        "results": results,
    }
