#!/usr/bin/env python3
"""DEMO 1 — The primitives, one at a time (OpenAI Agents SDK on AWS Bedrock).

What the class watches (nobody codes along):
  1. an Agent  = model + instructions + tools
  2. a tool call — the model DECIDES to call load_dispute, the harness executes it
  3. a handoff — Triage delegates to Evidence, control transfers
  4. streaming — every step visible as it happens (this is the harness working)

The model is Claude Haiku 4.5 on Amazon Bedrock, driven through the OpenAI
Agents SDK via LiteLLM. Same primitives, different cloud — that is the
portability lesson of the week.

Run:
    python3 demo1_primitives.py            # live (needs AWS creds in env)
    python3 demo1_primitives.py --mock     # zero-network walkthrough
"""
import asyncio
import json
import sys

from common import (C, MODEL_FAST, MeridianData, banner, okline, parse_args,
                    require_aws_or_exit, span)

ARGS = parse_args(sys.argv[1:])
DATA = MeridianData(mock=ARGS["mock"])


def _load_dispute_impl(dispute_id: int) -> str:
    d = DATA.get_dispute(dispute_id)
    span("tool", f"load_dispute({dispute_id})",
         f"reason_code={d['reason_code']}  amount=${int(d['amount_cents'])/100:.2f}  "
         f"sla_breached={d['sla_breached']}")
    return json.dumps({
        "dispute_id": d["dispute_id"], "reason_code": d["reason_code"],
        "dispute_type": d["dispute_type"], "amount_cents": d["amount_cents"],
        "sla_breached": d["sla_breached"], "reg_e_due_at": d["reg_e_due_at"],
        "customer_segment": d.get("customer_segment"),
    })


async def live() -> None:
    # Imports live inside so --mock never needs the SDK installed.
    import litellm
    litellm.modify_params = True  # Bedrock requires tools= when history has tool calls
    from agents import Agent, Runner, function_tool, set_tracing_disabled
    from agents.extensions.models.litellm_model import LitellmModel

    set_tracing_disabled(True)  # traces go to our console printer instead

    load_dispute = function_tool(_load_dispute_impl)

    evidence = Agent(
        name="Evidence",
        instructions=("You are the Evidence agent at Meridian Bank. Confirm in two "
                      "sentences what case you received and which source systems "
                      "you would query next (card_network, core_banking, crm)."),
        model=LitellmModel(model=MODEL_FAST),
    )

    triage = Agent(
        name="Triage",
        instructions=("You are the Triage agent at Meridian Bank. Call load_dispute "
                      "for the dispute id the user names. Classify it: reason codes "
                      "10.x/11.x are Type A (unauthorized/fraud, Regulation E applies); "
                      "12.x/13.x are Type B (merchant dispute). State the Reg E clock "
                      "status, then hand off to the Evidence agent."),
        model=LitellmModel(model=MODEL_FAST),
        tools=[load_dispute],
        handoffs=[evidence],
    )

    result = Runner.run_streamed(triage, f"Triage dispute {ARGS['dispute']}.")
    current = "Triage"
    async for ev in result.stream_events():
        if ev.type == "agent_updated_stream_event":
            if ev.new_agent.name != current:
                span("handoff", f"{current} ➜ {ev.new_agent.name}",
                     "control transferred — the SDK handoff primitive")
                current = ev.new_agent.name
            span("agent", f"{ev.new_agent.name} takes the turn")
        elif ev.type == "run_item_stream_event" and ev.item.type == "message_output_item":
            from agents import ItemHelpers
            text = ItemHelpers.text_message_output(ev.item)
            print(f"{C.DIM}    ┌─ {current} says ─────────────{C.END}")
            for ln in text.strip().splitlines():
                print(f"    {ln}")
            print(f"{C.DIM}    └──────────────────────────────{C.END}")
    okline(f"final agent: {result.last_agent.name}")
    okline("every step above = one SDK primitive doing its one job")


def mock() -> None:
    span("agent", "Triage takes the turn")
    _load_dispute_impl(ARGS["dispute"])
    print("    ┌─ Triage says ─────────────")
    print("    Dispute is Type A (unauthorized/fraud, reason 10.4). Reg E clock")
    print("    breached. Handing off to Evidence.")
    print("    └──────────────────────────────")
    span("handoff", "Triage ➜ Evidence", "control transferred — the SDK handoff primitive")
    span("agent", "Evidence takes the turn")
    print("    ┌─ Evidence says ─────────────")
    print("    Received dispute for evidence gathering. Next: card_network,")
    print("    core_banking, crm.")
    print("    └──────────────────────────────")
    okline("final agent: Evidence")
    okline("(mock walkthrough — run without --mock for the live Bedrock version)")


if __name__ == "__main__":
    banner("DEMO 1 — Agents SDK primitives on AWS Bedrock",
           f"Agent · tool · handoff · streaming    model={MODEL_FAST.split('/')[-1]}")
    if ARGS["mock"]:
        mock()
    else:
        require_aws_or_exit(False)
        asyncio.run(live())
