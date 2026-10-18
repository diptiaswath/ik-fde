"""Human-handoff — route to the human-approval queue when needed.

Routes to a human when ANY of:
  * the policy guardrail blocked the output (can't auto-act),
  * overall confidence is low,
  * the dispute is SLA-breached / RED on the Reg E clock,
  * a known data-integrity flag is set (e.g. provisional_credit_error),
  * the merchant is flagged watch/bad.

In production this enqueues to the Ops Console approval queue; here we just build
and print the handoff payload (HITL pattern from the lesson plan).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class HandoffDecision:
    route_to_human: bool
    queue: str | None
    reasons: list[str] = field(default_factory=list)
    payload: dict[str, Any] = field(default_factory=dict)


def decide(
    *,
    dispute_bundle: dict[str, Any],
    triage,
    evidence,
    policy,
    confidence_floor: float = 0.7,
) -> HandoffDecision:
    d = dispute_bundle["dispute"]
    overall_conf = min(triage.confidence, policy.confidence) if not policy.blocked else 0.0
    reasons: list[str] = []

    if policy.blocked:
        reasons.append("policy guardrail BLOCKED the recommendation")
    if overall_conf < confidence_floor:
        reasons.append(f"low confidence ({overall_conf:.2f} < {confidence_floor:.2f})")
    if triage.urgency in {"BREACHED", "RED"}:
        reasons.append(f"Reg E urgency = {triage.urgency}")
    if d.get("provisional_credit_error"):
        reasons.append("provisional_credit_error flag set on record")
    if evidence.merchant_risk in {"watch", "bad"}:
        reasons.append(f"merchant risk_status = {evidence.merchant_risk}")
    if not triage.classification_correct:
        reasons.append("triage class disagrees with recorded dispute_type")

    route = bool(reasons)
    queue = None
    if route:
        queue = "type_a_approval" if triage.dispute_type == "A" else "type_b_approval"

    payload = {
        "dispute_id": triage.dispute_id,
        "queue": queue,
        "classification": triage.classification,
        "urgency": triage.urgency,
        "recommendation": policy.recommendation,
        "policy_statement": policy.statement if not policy.blocked else "[withheld — guardrail block]",
        "cited_chunk_ids": policy.cited_chunk_ids,
        "evidence_systems": evidence.source_systems,
        "amount": evidence.amount_display,
        "confidence": round(overall_conf, 2),
        "reasons": reasons,
    }
    return HandoffDecision(route_to_human=route, queue=queue, reasons=reasons, payload=payload)
