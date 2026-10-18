#!/usr/bin/env python3
"""DEMO 2 — the end-to-end pipeline, for real: multi-agent + the complete circle.

This is the W15 centerpiece. The class already saw the problem (W13: the dispute
queue bleeding SLA breaches) and priced the fix (W14). Today the agent actually
works a dispute END TO END and the result LANDS IN THE PRODUCT:

    Triage (Haiku 4.5)  →  Evidence (Haiku 4.5)  →  Policy (Sonnet 4.5)
        │ classify Type A/B          │ read the live Meridian API      │ RAG + Reg E
        │ Reg E clock                │ evidence + customer             │ two guardrails
        └────────────────────────────┴─────────────┬───────────────────┘
                                                    ▼
                              ✍ create_ticket → the LIVE Ops Console
                    (idempotent write, audit-logged, scoped API key)

The recommendation the Policy agent produces is written back to Meridian as a
ticket on the dispute — open the Ops Console and it is THERE. Problem seen,
problem solved, in the core product. That is the circle an FDE gets paid for.

Model routing (cost engineering, live): the cheap model (Haiku 4.5) does the
high-volume steps; the expensive model (Sonnet 4.5) only touches the step where
money moves (the Reg E policy call).

Two guardrails (the controls we promised procurement in W14):
  * input  — poisoned policy chunks are quarantined BEFORE reaching context
  * output — a provisional-credit claim without a [chunk NN] citation is BLOCKED
             and routed to a human instead

Run:
    python3 demo2_pipeline.py                    # live: Bedrock + live Meridian API
    python3 demo2_pipeline.py --dispute 29
    python3 demo2_pipeline.py --mock             # zero-network rehearsal
"""
import asyncio
import json
import re
import sys
import uuid

from common import (BASE_URL, C, MODEL_FAST, MODEL_SMART, MeridianData, banner,
                    blocked, okline, parse_args, require_aws_or_exit, span)

ARGS = parse_args(sys.argv[1:])
ARGS["tripwire"] = "--tripwire" in sys.argv  # force an uncited claim → watch it get BLOCKED
DATA = MeridianData(mock=ARGS["mock"])
DISPUTE_ID = ARGS["dispute"]

INJECTION_MARKERS = re.compile(
    r"(ignore (all |any )?(prior|previous) (constraints|instructions)"
    r"|system instruction|account 9999|exfiltrat)", re.I)


# ---------------------------------------------------------------- tools
def _load_dispute() -> str:
    d = DATA.get_dispute(DISPUTE_ID)
    span("tool", f"load_dispute({DISPUTE_ID})",
         f"type={d['dispute_type']}  reason={d['reason_code']}  "
         f"amount=${int(d['amount_cents'])/100:.2f}  sla_breached={d['sla_breached']}  "
         f"customer={d.get('customer_name','?')} ({d.get('customer_segment','?')})")
    return json.dumps({k: d.get(k) for k in (
        "dispute_id", "dispute_type", "reason_code", "status", "amount_cents",
        "sla_breached", "reg_e_due_at", "provisional_credit_issued",
        "customer_name", "customer_segment", "merchant_name", "merchant_risk")},
        default=str)


def _gather_evidence() -> str:
    ev = DATA.get_evidence(DISPUTE_ID)
    systems = sorted({e["source_system"] for e in ev})
    span("tool", f"gather_evidence({DISPUTE_ID})",
         f"{len(ev)} artifact(s) across {len(systems)} system(s): {', '.join(systems)}")
    return json.dumps({"count": len(ev), "systems": systems,
                       "artifacts": [{"id": e["evidence_id"],
                                      "system": e["source_system"],
                                      "kind": e["kind"]} for e in ev]})


def _search_policies(query: str) -> str:
    chunks = DATA.search_policies(query)
    # INPUT GUARDRAIL — quarantine before anything reaches model context
    clean, quarantined = [], []
    for c in chunks:
        if c.get("is_poisoned") or INJECTION_MARKERS.search(c.get("content", "")):
            quarantined.append(c["chunk_id"])
        else:
            clean.append(c)
    span("tool", f'search_policies("{query}")',
         f"retrieved {len(chunks)} chunk(s) from the policy KB")
    if quarantined:
        span("guardrail", "input_guardrail: quarantine_poisoned", "")
        blocked(f"QUARANTINED poisoned chunk {quarantined} — prompt-injection NOT ingested")
    elif not DATA.mock:
        span("guardrail", "input_guardrail: quarantine_poisoned",
             "0 poisoned in this retrieval — the platform ALSO filters at the "
             "API layer (defense in depth)")
    return json.dumps([{"chunk_id": c["chunk_id"], "section": c.get("section"),
                        "content": c["content"]} for c in clean][:8])


# ------------------------------------------------- output guardrail + write-back
CITATION = re.compile(r"\[chunks?\s*\d[\d,\s\u2013\u2014-]*\]", re.I)  # [chunk 24] / [chunks 21-24, 32-34, 4]
MONEY_CLAIM = re.compile(r"provisional credit|refund|reimburse", re.I)


def citation_tripwire(text: str) -> tuple[bool, str]:
    """The output guardrail: money-moving claims must cite a policy chunk."""
    if MONEY_CLAIM.search(text) and not CITATION.search(text):
        return False, "uncited provisional-credit/refund claim"
    return True, ""


def write_back(recommendation: str, escalated_to_human: bool) -> dict:
    subject = ("HUMAN REVIEW NEEDED — guardrail tripped"
               if escalated_to_human else
               f"Agent recommendation — dispute {DISPUTE_ID}")
    idem = f"w15-demo-{DISPUTE_ID}-{uuid.uuid4().hex[:8]}"
    t = DATA.create_ticket(DISPUTE_ID, "chat", subject, recommendation[:1800], idem)
    span("write", f"create_ticket → Meridian  (Idempotency-Key: {idem})",
         f"ticket_id={t.get('ticket_id')}  status={t.get('status')}")
    return t


# ---------------------------------------------------------------- live pipeline
async def live() -> None:
    import litellm
    litellm.modify_params = True
    from agents import Agent, Runner, function_tool, set_tracing_disabled
    from agents.extensions.models.litellm_model import LitellmModel

    set_tracing_disabled(True)

    load_dispute = function_tool(_load_dispute)
    gather_evidence = function_tool(_gather_evidence)
    search_policies = function_tool(_search_policies)

    policy = Agent(
        name="Policy",
        instructions=(
            "You are the Policy agent at Meridian Bank. You receive a triaged, "
            "evidenced Type A dispute. Call search_policies ONCE with the query "
            "'Regulation E provisional credit' and work with whatever chunks come "
            "back — do NOT search again. Then produce a 3-5 sentence RECOMMENDATION. "
            + ("Do NOT include any [chunk NN] citations — just state your "
               "conclusion plainly. "  # --tripwire: the 'confidently wrong' rehearsal
               if ARGS["tripwire"] else
               "Rules: every statement about provisional credit MUST cite its "
               "policy chunk inline as [chunk NN]. ")
            + "If the Reg E clock is breached or evidence is thin, recommend "
              "human review. End with exactly one line: "
              "RECOMMENDATION: <ISSUE_PROVISIONAL_CREDIT | DENY | HUMAN_REVIEW>."),
        model=LitellmModel(model=MODEL_SMART),   # ← the money step gets the smart model
        tools=[search_policies],
    )

    evidence = Agent(
        name="Evidence",
        instructions=(
            "You are the Evidence agent at Meridian Bank. Call gather_evidence, "
            "confirm at least 3 source systems were touched, summarize what is on "
            "file in 2 sentences, then hand off to the Policy agent."),
        model=LitellmModel(model=MODEL_FAST),
        tools=[gather_evidence],
        handoffs=[policy],
    )

    triage = Agent(
        name="Triage",
        instructions=(
            "You are the Triage agent at Meridian Bank. Call load_dispute. "
            "Classify: reason codes 10.x/11.x → Type A (unauthorized/fraud, "
            "Regulation E applies); 12.x/13.x → Type B (merchant dispute). State "
            "the classification, confidence, and the Reg E clock status in 2 "
            "sentences, then hand off to the Evidence agent."),
        model=LitellmModel(model=MODEL_FAST),
        tools=[load_dispute],
        handoffs=[evidence],
    )

    print(f"{C.DIM}data backend: {'bundled fixture' if DATA.mock else 'LIVE Meridian API — ' + BASE_URL}{C.END}")
    print(f"{C.DIM}model routing: fast={MODEL_FAST.split('/')[-1]}  "
          f"smart={MODEL_SMART.split('/')[-1]}{C.END}\n")

    result = Runner.run_streamed(triage, f"Work dispute {DISPUTE_ID} end to end.",
                                 max_turns=20)
    current = "Triage"
    async for ev in result.stream_events():
        if ev.type == "agent_updated_stream_event":
            if ev.new_agent.name != current:
                span("handoff", f"{current} ➜ {ev.new_agent.name}",
                     f"model: {MODEL_SMART.split('/')[-1] if ev.new_agent.name=='Policy' else MODEL_FAST.split('/')[-1]}")
                current = ev.new_agent.name
        elif ev.type == "run_item_stream_event" and ev.item.type == "message_output_item":
            from agents import ItemHelpers
            text = ItemHelpers.text_message_output(ev.item).strip()
            if text:
                print(f"{C.DIM}    ┌─ {current} ─────────────{C.END}")
                for ln in text.splitlines():
                    print(f"    {ln}")
                print(f"{C.DIM}    └──────────────────────{C.END}")

    final = result.final_output or ""
    finish(final)


# ---------------------------------------------------------------- mock pipeline
def mock() -> None:
    print(f"{C.DIM}data backend: bundled fixture (zero network){C.END}\n")
    span("agent", "Triage (fast model)")
    _load_dispute()
    print("    Type A — unauthorized/fraud (reason 10.4), confidence 0.95.")
    print("    Reg E clock BREACHED — priority case.")
    span("handoff", "Triage ➜ Evidence", "")
    span("agent", "Evidence (fast model)")
    _gather_evidence()
    print("    4 artifacts on file across sharepoint, core_banking, servicenow.")
    span("handoff", "Evidence ➜ Policy", "")
    span("agent", "Policy (smart model)")
    _search_policies("Regulation E provisional credit timeline")
    cite = "" if ARGS["tripwire"] else " [chunk 101]"
    final = (f"Reg E applies: the bank must resolve or issue provisional credit "
             f"within 10 business days{cite}. The clock on this dispute is "
             f"already breached and provisional credit has not been issued. "
             f"Recommend immediate provisional credit and human confirmation.\n"
             f"RECOMMENDATION: HUMAN_REVIEW")
    print("    " + final.replace("\n", "\n    "))
    finish(final)


def finish(final: str) -> None:
    print()
    passed, why = citation_tripwire(final)
    if passed:
        span("guardrail", "output_guardrail: citation_tripwire",
             "money-moving claims are cited — PASS")
        t = write_back(final, escalated_to_human=False)
    else:
        span("guardrail", "output_guardrail: citation_tripwire", "")
        blocked(f"BLOCKED: {why} → routing to a human instead of auto-resolving")
        t = write_back(f"[guardrail-blocked output withheld]\n"
                       f"Reason: {why}. A human analyst must decide.",
                       escalated_to_human=True)
    print()
    okline("THE CIRCLE IS CLOSED — the agent's recommendation is now a ticket")
    if not DATA.mock:
        url = BASE_URL.replace("/api/v1", "")
        okline(f"see it in the product: {url}/disputes/{DISPUTE_ID}  "
               f"(ticket {t.get('ticket_id')})")
    okline("scoped key · audit-logged · idempotent — the W16 story starts here")


if __name__ == "__main__":
    banner("DEMO 2 — End-to-end pipeline + the complete circle",
           "triage → evidence → policy(+guardrails) → WRITE-BACK to the product")
    if ARGS["mock"]:
        mock()
    else:
        require_aws_or_exit(False)
        asyncio.run(live())
