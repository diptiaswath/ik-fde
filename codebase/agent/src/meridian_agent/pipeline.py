"""Pipeline orchestration — the whole game, one dispute, five steps.

    triage → handoff → evidence → policy(+guardrails) → human-handoff → eval

This is the function the instructor runs on stage in W13 hour 1. Everything it
needs is deterministic in --mock mode, so it never depends on a key or network.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from .agents import evidence as evidence_agent
from .agents import handoff as handoff_agent
from .agents import policy as policy_agent
from .agents import triage as triage_agent
from .trace import (
    BOLD, CYAN, DIM, GREEN, GREY, MAGENTA, RED, RESET, YELLOW, Tracer,
)


@dataclass
class Scorecard:
    dispute_id: int
    classification: str
    urgency: str
    recommendation: str
    classification_correct: bool
    policy_citation_present: bool
    reg_e_deadline_respected: bool
    guardrail_blocked: bool
    poisoned_quarantined: bool
    routed_to_human: bool
    handoff_queue: str | None
    overall_confidence: float
    checks: list[tuple[str, bool, str]] = field(default_factory=list)


def run_pipeline(
    repo,
    dispute_id: str | int,
    *,
    tracer: Tracer,
    demo_tripwire: bool = False,
    now: datetime | None = None,
) -> Scorecard:
    now = now or datetime.now(timezone.utc)

    # ---- load the dispute bundle (the data contract) -----------------------
    with tracer.span("load_dispute_bundle", kind="tool") as t:
        bundle = repo.get_dispute_bundle(dispute_id)
        d = bundle["dispute"]
        t.event(f"loaded dispute {d['dispute_id']} from {repo.backend}", level="tool")
        t.kv("txn_id", d["txn_id"])
        t.kv("customer", bundle["customer"]["full_name"])
        t.kv("amount", f"${bundle['transaction']['amount_cents'] / 100:,.2f}")

    # ---- 1. TRIAGE ---------------------------------------------------------
    with tracer.span("triage_agent.classify", kind="agent") as t:
        triage = triage_agent.run(bundle, now=now)
        t.event(triage.rationale)
        t.kv("classification", triage.classification)
        urg_color = {"BREACHED": RED, "RED": RED, "AMBER": YELLOW, "GREEN": GREEN}.get(
            triage.urgency, ""
        )
        t.kv("urgency", f"{urg_color}{triage.urgency}{RESET} ({triage.hours_to_deadline:,.0f}h)")
        t.kv("confidence", f"{triage.confidence:.2f}")
        t.event("classified, handing off to Evidence agent", level="ok")

    # ---- HANDOFF ----------------------------------------------------------
    with tracer.span("handoff: Triage ➜ Evidence", kind="handoff") as t:
        t.event("control transferred (Agents SDK handoff)", level="info")

    # ---- 2. EVIDENCE -------------------------------------------------------
    with tracer.span("evidence_agent.gather", kind="agent") as t:
        ev = evidence_agent.run(bundle)
        for sysname in ev.source_systems:
            t.event(f"read {sysname}", level="tool")
        t.kv("systems touched", f"{ev.system_count} ({', '.join(ev.source_systems)})")
        t.kv(">=3 systems", f"{GREEN}yes{RESET}" if ev.sufficient else f"{RED}NO{RESET}")
        for f in ev.facts:
            t.event(f"{DIM}{f}{RESET}")
        t.event("evidence consolidated", level="ok")

    # ---- 3. POLICY (+ guardrails) -----------------------------------------
    with tracer.span("policy_agent.apply_reg_e", kind="agent") as t:
        chunks = repo.get_policy_chunks()
        t.event(f"retrieved {len(chunks)} policy_chunks (RAG over Reg E KB)", level="tool")

        needs_pc = _needs_provisional_credit(triage, bundle)
        decision, gtrace = policy_agent.run(
            chunks,
            dispute_id=triage.dispute_id,
            needs_provisional_credit=needs_pc,
            demo_tripwire=demo_tripwire,
        )

        # input guardrail: quarantine
        with tracer.span("input_guardrail: quarantine_poisoned", kind="guardrail") as g:
            if decision.quarantined_chunk_ids:
                for cid in decision.quarantined_chunk_ids:
                    g.event(
                        f"QUARANTINED poisoned chunk {cid} — prompt-injection NOT ingested",
                        level="block",
                    )
                g.kv("quarantined ids", decision.quarantined_chunk_ids)
            else:
                g.event("no poisoned chunks in retrieval set", level="ok")

        t.kv("recommendation", f"{BOLD}{decision.recommendation}{RESET}")
        t.event(f"draft statement: {DIM}{decision.statement}{RESET}")

        # output guardrail: Reg E citation tripwire
        with tracer.span("output_guardrail: reg_e_citation_tripwire", kind="guardrail") as g:
            tw = gtrace["tripwire"]
            if tw.triggered:
                g.event(decision.tripwire_reason, level="block")
                g.event(f"{RED}{BOLD}OUTPUT BLOCKED — not returned to human{RESET}", level="block")
            elif tw.mentions_provisional_credit:
                g.event(
                    f"provisional-credit claim grounded in chunk(s) {decision.cited_chunk_ids}",
                    level="cite",
                )
            else:
                g.event("no provisional-credit claim to gate", level="ok")

    # ---- 4. HUMAN HANDOFF --------------------------------------------------
    with tracer.span("human_handoff.route", kind="agent") as t:
        handoff = handoff_agent.decide(
            dispute_bundle=bundle, triage=triage, evidence=ev, policy=decision
        )
        if handoff.route_to_human:
            t.event(f"{YELLOW}ROUTING TO HUMAN-APPROVAL QUEUE{RESET} → {handoff.queue}", level="warn")
            for r in handoff.reasons:
                t.event(f"reason: {r}", level="warn")
            t.event(f"{DIM}handoff payload:{RESET}")
            _print_payload(handoff.payload, indent="        ")
        else:
            t.event("auto-resolved within policy; no human approval required", level="ok")

    # ---- 5. EVAL SCORECARD -------------------------------------------------
    overall_conf = handoff.payload["confidence"]
    sc = _build_scorecard(triage, ev, decision, handoff, overall_conf)
    _print_scorecard(sc, tracer)
    return sc


def _needs_provisional_credit(triage, bundle: dict[str, Any]) -> bool:
    """A provisional-credit obligation is in play for unauthorized (Type A)
    disputes still being investigated, or any breached/red-clock dispute that
    hasn't been credited yet."""
    d = bundle["dispute"]
    if d.get("provisional_credit_issued"):
        return False
    if triage.dispute_type == "A" and d["status"] in {"intake", "investigating"}:
        return True
    if triage.urgency in {"BREACHED", "RED"}:
        return True
    return False


def _build_scorecard(triage, ev, decision, handoff, overall_conf) -> Scorecard:
    pc_present = bool(decision.cited_chunk_ids) if decision.rule_applies else True
    deadline_ok = triage.urgency != "BREACHED" or handoff.route_to_human
    checks = [
        ("classification produced", True, triage.classification),
        (
            "classification matches recorded type",
            triage.classification_correct,
            "" if triage.classification_correct else "disagrees → flagged",
        ),
        ("evidence from >=3 systems", ev.sufficient, f"{ev.system_count} systems"),
        ("poisoned chunk quarantined", bool(decision.quarantined_chunk_ids),
         f"ids {decision.quarantined_chunk_ids}" if decision.quarantined_chunk_ids else "none in set"),
        (
            "policy citation present (if rule applies)",
            pc_present,
            f"chunks {decision.cited_chunk_ids}" if decision.cited_chunk_ids else "n/a",
        ),
        (
            "guardrail enforced (no uncited PC claim)",
            not decision.blocked,
            "BLOCKED uncited claim" if decision.blocked else "clean",
        ),
        (
            "Reg E deadline respected",
            deadline_ok,
            "" if deadline_ok else "BREACHED & not escalated",
        ),
        (
            "handoff decision made",
            True,
            f"→ {handoff.queue}" if handoff.route_to_human else "auto-resolved",
        ),
    ]
    return Scorecard(
        dispute_id=triage.dispute_id,
        classification=triage.classification,
        urgency=triage.urgency,
        recommendation=decision.recommendation,
        classification_correct=triage.classification_correct,
        policy_citation_present=pc_present,
        reg_e_deadline_respected=deadline_ok,
        guardrail_blocked=decision.blocked,
        poisoned_quarantined=bool(decision.quarantined_chunk_ids),
        routed_to_human=handoff.route_to_human,
        handoff_queue=handoff.queue,
        overall_confidence=overall_conf,
        checks=checks,
    )


def _print_payload(payload: dict[str, Any], indent: str = "") -> None:
    import json

    for line in json.dumps(payload, indent=2, ensure_ascii=False).splitlines():
        print(f"{indent}{GREY}{line}{RESET}")


def _print_scorecard(sc: Scorecard, tracer: Tracer) -> None:
    bar = "─" * 64
    print(f"\n{BOLD}{CYAN}┌{bar}┐{RESET}")
    print(f"{BOLD}{CYAN}│{RESET} {BOLD}EVAL SCORECARD — dispute {sc.dispute_id:<41}{RESET}{BOLD}{CYAN}│{RESET}")
    print(f"{BOLD}{CYAN}├{bar}┤{RESET}")
    for name, ok, note in sc.checks:
        mark = f"{GREEN}PASS{RESET}" if ok else f"{RED}FAIL{RESET}"
        note_s = f"{GREY}{note}{RESET}" if note else ""
        print(f"{CYAN}│{RESET} [{mark}] {name:<40} {note_s}")
    print(f"{BOLD}{CYAN}├{bar}┤{RESET}")
    decision = (
        f"{YELLOW}HUMAN APPROVAL ({sc.handoff_queue}){RESET}"
        if sc.routed_to_human
        else f"{GREEN}AUTO-RESOLVED{RESET}"
    )
    print(f"{CYAN}│{RESET} outcome: {decision}   confidence: {sc.overall_confidence:.2f}")
    print(f"{BOLD}{CYAN}└{bar}┘{RESET}")
    print(f"{GREY}total pipeline wall time: {tracer.total_ms():.1f} ms · trace_id={tracer.trace_id}{RESET}\n")
