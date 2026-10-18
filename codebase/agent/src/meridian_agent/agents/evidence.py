"""Evidence agent — gather evidence from >=3 source systems and summarize.

The whole reason disputes are *genuinely agentic*: evidence is scattered across
core_banking, servicenow, sharepoint, and card_network. This agent reads the
dispute_evidence rows plus the transaction and customer (so >=3 systems even
when evidence rows are sparse) and produces a short factual summary.

SDK seam (W15): an Agent with function tools
    @function_tool def fetch_evidence(dispute_id): ...
    @function_tool def fetch_transaction(txn_id): ...
    @function_tool def fetch_customer(customer_id): ...
The mock below calls the same data the tools would return.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class EvidenceSummary:
    dispute_id: int
    source_systems: list[str]
    system_count: int
    evidence_count: int
    summary: str
    amount_display: str
    merchant_risk: str
    facts: list[str] = field(default_factory=list)
    sufficient: bool = False


def _dollars(cents: int | None) -> str:
    if cents is None:
        return "n/a"
    return f"${cents / 100:,.2f}"


def run(bundle: dict[str, Any]) -> EvidenceSummary:
    d = bundle["dispute"]
    txn = bundle.get("transaction") or {}
    cust = bundle.get("customer") or {}
    merch = bundle.get("merchant") or {}
    evidence = bundle.get("evidence") or []

    # Systems touched: the evidence rows PLUS the two systems we always read
    # directly (core banking for the txn, CRM for the customer 360).
    systems = {e["source_system"] for e in evidence}
    systems.add("core_banking")  # transaction lookup
    systems.add("crm")           # customer 360
    source_systems = sorted(systems)

    amount = _dollars(txn.get("amount_cents"))
    facts = [
        f"Transaction {txn.get('txn_id')} for {amount} via {txn.get('channel')} "
        f"at '{merch.get('name', '?')}' (MCC {txn.get('mcc')}).",
        f"Customer {cust.get('full_name', '?')} — {cust.get('segment', '?')} segment, "
        f"member since {str(cust.get('joined_at', ''))[:10]}.",
        f"Merchant risk_status = {merch.get('risk_status', 'unknown')}.",
        f"{len(evidence)} evidence artifact(s) on file across "
        f"{', '.join(sorted({e['source_system'] for e in evidence}))}.",
    ]
    if d.get("provisional_credit_issued"):
        facts.append(
            f"Provisional credit already issued: {_dollars(d.get('provisional_credit_cents'))}"
            + (" — FLAGGED as a provisional_credit_error." if d.get("provisional_credit_error") else ".")
        )

    summary = (
        f"Dispute {d['dispute_id']} ({amount}, merchant '{merch.get('name','?')}', "
        f"risk={merch.get('risk_status','?')}). Evidence consolidated from "
        f"{len(source_systems)} systems: {', '.join(source_systems)}."
    )

    return EvidenceSummary(
        dispute_id=int(d["dispute_id"]),
        source_systems=source_systems,
        system_count=len(source_systems),
        evidence_count=len(evidence),
        summary=summary,
        amount_display=amount,
        merchant_risk=merch.get("risk_status", "unknown"),
        facts=facts,
        sufficient=len(source_systems) >= 3,
    )
