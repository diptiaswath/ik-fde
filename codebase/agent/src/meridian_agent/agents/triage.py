"""Triage agent — classify dispute type and urgency from the Reg E clock.

SDK seam (W15):
    triage_agent = Agent(
        name="Triage",
        instructions=TRIAGE_INSTRUCTIONS,
        handoffs=[evidence_agent],        # hands off to Evidence next
        output_type=TriageDecision,
    )
The mock reasoner below is the deterministic stand-in for that Agent's output.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

# Reason-code families seeded into the data (card-network style).
_TYPE_A_REASONS = {"10.1", "10.4", "11.2", "11.3"}  # unauthorized / fraud
_TYPE_B_REASONS = {"12.5", "13.1", "13.2", "13.7"}  # merchant / quality


@dataclass
class TriageDecision:
    dispute_id: int
    classification: str          # "Type A — unauthorized/fraud" | "Type B — merchant/quality"
    dispute_type: str            # "A" | "B"
    classification_correct: bool
    urgency: str                 # "BREACHED" | "RED" | "AMBER" | "GREEN"
    hours_to_deadline: float
    reg_e_due_at: str
    rationale: str
    confidence: float


def _classify_type(reason_code: str, recorded_type: str) -> tuple[str, str, bool]:
    if reason_code in _TYPE_A_REASONS:
        inferred = "A"
    elif reason_code in _TYPE_B_REASONS:
        inferred = "B"
    else:
        inferred = recorded_type  # unknown code → trust the record
    label = (
        "Type A — unauthorized/fraud"
        if inferred == "A"
        else "Type B — merchant/quality"
    )
    return inferred, label, inferred == recorded_type


def _urgency(hours: float, breached: bool) -> str:
    if breached or hours < 0:
        return "BREACHED"
    if hours <= 48:
        return "RED"
    if hours <= 120:
        return "AMBER"
    return "GREEN"


def run(bundle: dict[str, Any], *, now: datetime | None = None) -> TriageDecision:
    now = now or datetime.now(timezone.utc)
    d = bundle["dispute"]
    due = datetime.fromisoformat(d["reg_e_due_at"])
    hours = (due - now).total_seconds() / 3600.0
    breached = bool(d.get("sla_breached")) or hours < 0

    inferred_type, label, correct = _classify_type(d["reason_code"], d["dispute_type"])
    urgency = _urgency(hours, breached)

    rationale = (
        f"reason_code {d['reason_code']} → {label}. "
        f"Reg E 10-business-day clock due {due.date()} "
        f"({hours:,.0f}h out) → urgency {urgency}."
    )
    # Confidence dips when the inferred class disagrees with the recorded class.
    confidence = 0.95 if correct else 0.55

    return TriageDecision(
        dispute_id=int(d["dispute_id"]),
        classification=label,
        dispute_type=inferred_type,
        classification_correct=correct,
        urgency=urgency,
        hours_to_deadline=round(hours, 1),
        reg_e_due_at=d["reg_e_due_at"],
        rationale=rationale,
        confidence=confidence,
    )
