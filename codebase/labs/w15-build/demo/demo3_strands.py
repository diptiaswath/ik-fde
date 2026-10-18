#!/usr/bin/env python3
"""DEMO 3 — Same problem, second harness: Strands Agents (AWS's agent SDK).

The generalization lesson of the week. We rebuild demo 1's triage agent in
Strands Agents — the SDK AWS itself uses for Amazon Q Developer and AWS Glue —
in ~20 lines. Watch what changes and what doesn't:

    CHANGES                          DOESN'T CHANGE
    ─────────────────────────        ────────────────────────────────────
    import path / class names        the primitives: agent, model, tools
    model wiring (native Bedrock)    the tool = a plain Python function
    loop style (agentic loop         the instructions (the actual FDE work)
      driven by the model)           the problem decomposition
                                     YOUR mental model

An FDE who learned the PRIMITIVES in demo 1 reads this cold. An FDE who
learned "the framework" starts over. That's why we teach the nouns, not the
brand names. (Deep dive + more Strands: supplementary/strands_agents.md)

Run:
    python3 demo3_strands.py            # live (needs AWS creds)
    python3 demo3_strands.py --mock     # zero-network walkthrough
"""
import json
import sys

from common import (MODEL_FAST, C, MeridianData, banner, okline, parse_args,
                    require_aws_or_exit, span)

ARGS = parse_args(sys.argv[1:])
DATA = MeridianData(mock=ARGS["mock"])

BEDROCK_MODEL_ID = MODEL_FAST.split("bedrock/converse/")[-1]  # native id, no bridge


def _load_dispute_impl(dispute_id: int) -> str:
    d = DATA.get_dispute(dispute_id)
    span("tool", f"load_dispute({dispute_id})",
         f"reason_code={d['reason_code']}  amount=${int(d['amount_cents'])/100:.2f}  "
         f"sla_breached={d['sla_breached']}")
    return json.dumps({
        "dispute_id": d["dispute_id"], "reason_code": d["reason_code"],
        "dispute_type": d["dispute_type"], "amount_cents": d["amount_cents"],
        "sla_breached": d["sla_breached"], "reg_e_due_at": str(d["reg_e_due_at"]),
    })


def live() -> None:
    # ---- the whole Strands version fits on one slide ----
    from strands import Agent, tool
    from strands.models import BedrockModel

    @tool
    def load_dispute(dispute_id: int) -> str:
        """Load a payment dispute by id from the Meridian platform."""
        return _load_dispute_impl(dispute_id)

    agent = Agent(
        model=BedrockModel(model_id=BEDROCK_MODEL_ID, streaming=True),
        system_prompt=("You are the Triage agent at Meridian Bank. Call "
                       "load_dispute for the id the user names. Reason codes "
                       "10.x/11.x are Type A (unauthorized/fraud, Regulation E "
                       "applies); 12.x/13.x are Type B. Give the classification, "
                       "Reg E clock status, and next step in 3 sentences."),
        tools=[load_dispute],
    )
    span("agent", "Strands agentic loop starts",
         f"model={BEDROCK_MODEL_ID} (native Bedrock — no bridge layer)")
    result = agent(f"Triage dispute {ARGS['dispute']}.")
    print()
    okline("same problem, same tool, same instructions — different harness")
    okline("what you learned in demo 1 transferred at ~zero cost")


def mock() -> None:
    span("agent", "Strands agentic loop starts",
         f"model={BEDROCK_MODEL_ID} (native Bedrock — no bridge layer)")
    _load_dispute_impl(ARGS["dispute"])
    print("    Dispute 29 is Type A — unauthorized/fraud (reason 10.4), and its")
    print("    Regulation E clock is already breached. Next step: hand to the")
    print("    Evidence agent and prioritize for provisional-credit review.")
    print()
    okline("same problem, same tool, same instructions — different harness")
    okline("(mock walkthrough — run without --mock for live Bedrock)")


if __name__ == "__main__":
    banner("DEMO 3 — Portability: the triage agent in Strands Agents",
           "the primitives generalize; the brand names don't matter")
    if ARGS["mock"]:
        mock()
    else:
        require_aws_or_exit(False)
        live()
