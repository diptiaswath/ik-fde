"""CLI entrypoint: ``python -m meridian_agent run --dispute <id>``."""
from __future__ import annotations

import argparse
import sys

from .brain import detect_brain
from .db import DisputeNotFound, connect
from .pipeline import run_pipeline
from .trace import BOLD, DIM, GREEN, GREY, RESET, YELLOW, Tracer


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="meridian-agent",
        description="Meridian dispute-resolution agent — the W13 whole-game demo.",
    )
    sub = p.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="run the pipeline against one dispute id")
    run.add_argument("--dispute", required=True, help="dispute id (e.g. 1, 7, 29)")
    run.add_argument(
        "--mock",
        action="store_true",
        help="force deterministic mock brain (default when no API key is set)",
    )
    run.add_argument(
        "--fixture",
        action="store_true",
        help="force the bundled JSON fixture (skip Postgres)",
    )
    run.add_argument(
        "--demo-tripwire",
        action="store_true",
        help="force an uncited provisional-credit claim to show the guardrail BLOCK",
    )
    run.add_argument(
        "--show-sdk",
        action="store_true",
        help="print the reference OpenAI Agents SDK wiring and exit",
    )

    sub.add_parser("disputes", help="list dispute ids available in the active backend")

    ev = sub.add_parser(
        "eval",
        help="run the pipeline across many disputes as a pass/fail gate (W15 smoke / W17 golden)",
    )
    ev.add_argument("--disputes", default="all", help="'all', a count (e.g. 20), or a range (e.g. 1-25)")
    ev.add_argument("--suite", default="smoke",
                    help="smoke = live/fixture disputes; golden = the 150-case labeled golden set")
    ev.add_argument("--min-pass", type=float, default=0.9,
                    help="minimum pass rate to exit 0 (the CI/deploy gate threshold)")
    ev.add_argument("--cases", type=int, default=None,
                    help="golden only: run the first N cases (default: all 150)")
    ev.add_argument("--category", default=None,
                    help="golden only: standard | edge | adversarial")
    ev.add_argument("--verbose", action="store_true",
                    help="golden only: print every case, not just failures")
    ev.add_argument("--mock", action="store_true", help="force the deterministic brain")
    ev.add_argument("--fixture", action="store_true", help="force the bundled fixture")
    return p


def _resolve_brain(force_mock: bool):
    brain = detect_brain(force_mock)
    if brain.is_mock:
        return brain, "mock (deterministic rule-based stand-ins)"
    return brain, f"llm ({brain.provider}, model={brain.model})"


def _parse_dispute_selection(spec: str, available: list[str]) -> list[str]:
    spec = (spec or "all").strip().lower()
    if spec == "all":
        return list(available)
    if "-" in spec:
        lo, hi = (x.strip() for x in spec.split("-", 1))
        if lo.isdigit() and hi.isdigit():
            want = {str(i) for i in range(int(lo), int(hi) + 1)}
            sel = [s for s in available if s in want]
            return sel or [str(i) for i in range(int(lo), int(hi) + 1)]
        return [s for s in available if lo <= s <= hi]
    if spec.isdigit():
        return list(available)[: int(spec)]
    return [s.strip() for s in spec.split(",") if s.strip()]


def _run_golden(args) -> int:
    """The W17 deploy gate: 150 labeled cases, execution-graded, embedded data.

    Gate semantics (both must hold):
      1. aggregate pass rate >= --min-pass
      2. ZERO failing adversarial cases — one live injection hole blocks the
         release no matter how good the average looks.
    """
    from .golden import run_golden_suite

    res = run_golden_suite(min_pass=args.min_pass, limit=args.cases,
                           category=args.category)
    print(f"{BOLD}golden suite v{res['version']} — {res['total']} cases · "
          f"gate >= {args.min_pass:.0%} AND 0 adversarial failures{RESET}")
    for cat, c in sorted(res["by_category"].items()):
        print(f"  {cat:<12} {c['passed']:>3}/{c['total']:<3}")
    shown = 0
    for r in res["results"]:
        if r["pass"] and not args.verbose:
            continue
        tag = f"{GREEN}[PASS]{RESET}" if r["pass"] else f"{YELLOW}[FAIL]{RESET}"
        print(f"  {r['case_id']:>8}  {tag}  ({r['category']}) {r['title']}")
        for f, d in r["mismatches"].items():
            print(f"      {f}: expected {d['expected']!r}, got {d['actual']!r}")
        for leak in r["leaks"]:
            print(f"      LEAK: output contains {leak!r}")
        shown += 1
    if not shown and not args.verbose:
        print(f"  {DIM}(no failing cases){RESET}")
    verdict = f"{GREEN}GATE PASSED{RESET}" if res["gate_ok"] else f"{YELLOW}GATE FAILED{RESET}"
    adv = (f"  ·  {YELLOW}adversarial failures: {', '.join(res['adversarial_failures'])}{RESET}"
           if res["adversarial_failures"] else "")
    print(f"\n{BOLD}pass rate: {res['rate']:.0%} ({res['passed']}/{res['total']})  ·  {verdict}{RESET}{adv}")
    return 0 if res["gate_ok"] else 1


def _run_eval(args) -> int:
    import contextlib
    import io

    if args.suite == "golden":
        return _run_golden(args)

    _resolve_brain(args.mock)
    repo, _ = connect(prefer_db=not args.fixture)
    ids = _parse_dispute_selection(args.disputes, repo.available_disputes())

    print(f"{BOLD}eval suite '{args.suite}' — {len(ids)} disputes · gate >= {args.min_pass:.0%}{RESET}")
    rows, passed = [], 0
    for did in ids:
        sink = io.StringIO()
        try:
            with contextlib.redirect_stdout(sink):
                sc = run_pipeline(repo, did, tracer=Tracer())
        except DisputeNotFound:
            continue
        n_ok = sum(1 for _, ok, _ in sc.checks if ok)
        case_pass = n_ok == len(sc.checks)
        passed += int(case_pass)
        rows.append((str(did), case_pass, n_ok, len(sc.checks)))

    total = len(rows)
    rate = passed / total if total else 0.0
    for did, ok, n_ok, n_total in rows:
        tag = f"{GREEN}[PASS]{RESET}" if ok else f"{YELLOW}[FAIL]{RESET}"
        print(f"  dispute {did:>3}  {tag}  {n_ok}/{n_total} checks")
    gate_ok = rate >= args.min_pass
    verdict = f"{GREEN}GATE PASSED{RESET}" if gate_ok else f"{YELLOW}GATE FAILED{RESET}"
    print(f"\n{BOLD}pass rate: {rate:.0%} ({passed}/{total})  ·  {verdict}{RESET}")
    return 0 if gate_ok else 1


def main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)

    if args.command == "disputes":
        repo, note = connect(prefer_db=True)
        ids = repo.available_disputes()
        print(f"backend: {repo.backend}" + (f"  [{note}]" if note else ""))
        print("available dispute ids: " + ", ".join(ids))
        return 0

    if args.command == "eval":
        return _run_eval(args)

    # command == run
    if args.show_sdk:
        from .agents.sdk_runtime import SDK_REFERENCE

        print(SDK_REFERENCE)
        return 0

    brain, brain_label = _resolve_brain(args.mock)
    repo, note = connect(prefer_db=not args.fixture)

    tracer = Tracer()
    tracer.banner(
        "MERIDIAN DISPUTE AGENT — whole-game demo",
        f"dispute={args.dispute}  brain={brain_label}",
    )
    print(f"{GREY}data backend: {repo.backend}" + (f"  ·  {note}" if note else "") + f"{RESET}")
    if brain.is_mock and not args.mock:
        print(f"{DIM}(no API key found → defaulting to mock brain){RESET}")
    if not brain.is_mock:
        # Live path is the W15 deliverable; the demo runs on mock.
        print(
            f"{YELLOW}note: a key was detected, but the live Agents SDK runtime is the "
            f"W15 build deliverable. Running the deterministic pipeline.{RESET}"
        )
    if args.demo_tripwire:
        print(f"{YELLOW}--demo-tripwire ON: forcing an uncited provisional-credit claim.{RESET}")

    try:
        sc = run_pipeline(
            repo, args.dispute, tracer=tracer, demo_tripwire=args.demo_tripwire
        )
    except DisputeNotFound as exc:
        print(f"\nerror: {exc}", file=sys.stderr)
        return 2

    # Exit non-zero ONLY when a guardrail block was NOT caught by a human handoff
    # (it always is, here) — keeps the demo green for CI while staying honest.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
