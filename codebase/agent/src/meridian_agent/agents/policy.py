"""Policy agent — retrieve Reg E policy, apply the rule, under two guardrails.

Flow:
  1. retrieve policy_chunks (RAG stand-in: keyword score over Reg E content)
  2. INPUT GUARDRAIL: quarantine any is_poisoned chunk BEFORE it reaches context
  3. reason: does the Reg E 10-business-day provisional-credit rule apply?
  4. OUTPUT GUARDRAIL: any provisional-credit statement MUST cite a policy chunk,
     else the output is tripwired/blocked.

SDK seam (W15):
    policy_agent = Agent(
        name="Policy",
        instructions=POLICY_INSTRUCTIONS,
        input_guardrails=[quarantine_poisoned_guardrail],
        output_guardrails=[reg_e_citation_guardrail],
        output_type=PolicyDecision,
    )
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..guardrail import (
    check_provisional_credit_citation,
    quarantine_poisoned,
)


@dataclass
class PolicyDecision:
    dispute_id: int
    rule_applies: bool
    recommendation: str
    statement: str                       # the human-facing answer (post-guardrail)
    cited_chunk_ids: list[int] = field(default_factory=list)
    retrieved_chunk_ids: list[int] = field(default_factory=list)
    quarantined_chunk_ids: list[int] = field(default_factory=list)
    tripwire_triggered: bool = False
    tripwire_reason: str = ""
    blocked: bool = False
    confidence: float = 0.0


# A deliberately broken candidate output used ONLY to demonstrate the tripwire
# firing on stage. The instructor flips --demo-tripwire to route through this.
_UNCITED_CLAIM = (
    "Recommend issuing provisional credit within 10 business days per Reg E."
)


def _retrieve(chunks: list[dict[str, Any]], query: str) -> list[dict[str, Any]]:
    """Trivial keyword-overlap retriever (RAG stand-in). Returns Reg E chunks
    ranked by term overlap. The real build swaps in Azure AI Search."""
    terms = {t.lower() for t in query.split()}
    scored = []
    for c in chunks:
        text = f"{c['section']} {c['content']}".lower()
        score = sum(1 for t in terms if t in text)
        scored.append((score, c))
    scored.sort(key=lambda s: s[0], reverse=True)
    return [c for score, c in scored if score > 0] or [c for _, c in scored[:2]]


def run(
    chunks: list[dict[str, Any]],
    *,
    dispute_id: int,
    needs_provisional_credit: bool,
    demo_tripwire: bool = False,
) -> tuple[PolicyDecision, dict[str, Any]]:
    """Returns (decision, guardrail_trace) so the CLI can render every step."""
    trace: dict[str, Any] = {}

    # 1. retrieve (RAG)
    query = "provisional credit reg e 10 business days investigation timeline"
    retrieved = _retrieve(chunks, query)
    trace["retrieved_ids"] = [c["chunk_id"] for c in retrieved]

    # 2. INPUT GUARDRAIL — quarantine poisoned chunks before they hit context.
    q = quarantine_poisoned(retrieved)
    trace["quarantined_ids"] = q.quarantined_ids
    safe_chunks = q.safe_chunks
    valid_ids = {c["chunk_id"] for c in safe_chunks}

    # 3. reason over SAFE chunks only. Find the provisional-credit chunk to cite.
    pc_chunk = next(
        (c for c in safe_chunks if "provisional" in c["content"].lower()), None
    )

    if needs_provisional_credit and pc_chunk is not None:
        rule_applies = True
        # Correct behaviour: cite the chunk id inline so the output guardrail passes.
        statement = (
            f"Reg E applies: issue provisional credit within 10 business days "
            f"while the investigation completes [chunk {pc_chunk['chunk_id']}]."
        )
        recommendation = "ISSUE_PROVISIONAL_CREDIT"
        confidence = 0.9
    elif needs_provisional_credit and pc_chunk is None:
        rule_applies = True
        # The only policy basis was quarantined → we cannot ground the claim.
        statement = _UNCITED_CLAIM
        recommendation = "ESCALATE_NO_POLICY_BASIS"
        confidence = 0.4
    else:
        rule_applies = False
        statement = (
            "No provisional-credit obligation triggered; continue standard "
            "investigation within the 45-day Reg E window [chunk 2]."
            if any(c["chunk_id"] == 2 for c in safe_chunks)
            else "No provisional-credit obligation triggered; continue standard investigation."
        )
        recommendation = "CONTINUE_INVESTIGATION"
        confidence = 0.85

    # --demo-tripwire forces the broken uncited claim to show the wire firing.
    if demo_tripwire:
        statement = _UNCITED_CLAIM
        recommendation = "ISSUE_PROVISIONAL_CREDIT"

    # 4. OUTPUT GUARDRAIL — provisional-credit claims must cite a valid chunk.
    tw = check_provisional_credit_citation(statement, valid_chunk_ids=valid_ids)
    trace["tripwire"] = tw

    blocked = tw.triggered
    decision = PolicyDecision(
        dispute_id=dispute_id,
        rule_applies=rule_applies,
        recommendation=recommendation if not blocked else "BLOCKED_BY_GUARDRAIL",
        statement=statement,
        cited_chunk_ids=tw.cited_chunk_ids,
        retrieved_chunk_ids=trace["retrieved_ids"],
        quarantined_chunk_ids=q.quarantined_ids,
        tripwire_triggered=tw.triggered,
        tripwire_reason=tw.reason,
        blocked=blocked,
        confidence=confidence if not blocked else 0.0,
    )
    return decision, trace
