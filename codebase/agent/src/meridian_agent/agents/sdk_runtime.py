"""Real-LLM runtime — OpenAI Agents SDK + Responses API.

THIS MODULE IS THE 'REAL AGENTS GO HERE' SEAM.

It is imported ONLY when a key is present and --mock was not passed. In the W15
build, students flesh these Agents out and the rest of the pipeline (db.py,
guardrail.py, trace.py, the scorecard) is reused unchanged.

The structure below mirrors `pipeline.py` exactly: Triage hands off to Evidence,
Evidence to Policy, Policy carries the two guardrails, then human handoff. We
keep it as a documented shim (not dead code pretending to work) so the demo's
mock path is the source of truth and the SDK wiring is unambiguous to copy.
"""
from __future__ import annotations

from typing import Any

# Reference wiring — what the W15 lab builds. Kept as a string so importing this
# module never hard-fails when openai-agents isn't installed; the CLI prints it
# when --show-sdk is passed.
SDK_REFERENCE = '''
from agents import (
    Agent, Runner, SQLiteSession, function_tool,
    input_guardrail, output_guardrail, GuardrailFunctionOutput,
)
from meridian_agent.guardrail import (
    quarantine_poisoned, check_provisional_credit_citation,
)

# --- tools (wrap the same db.py used by the mock path) ----------------------
@function_tool
def fetch_evidence(dispute_id: int) -> dict: ...
@function_tool
def search_policy(query: str) -> list[dict]: ...

# --- guardrails -------------------------------------------------------------
@input_guardrail
async def quarantine_poisoned_guardrail(ctx, agent, chunks):
    q = quarantine_poisoned(chunks)
    return GuardrailFunctionOutput(
        output_info={"quarantined": q.quarantined_ids},
        tripwire_triggered=False,   # quarantine, don't block the run
    )

@output_guardrail
async def reg_e_citation_guardrail(ctx, agent, output):
    tw = check_provisional_credit_citation(output.statement, valid_chunk_ids=ctx.valid_ids)
    return GuardrailFunctionOutput(output_info=tw, tripwire_triggered=tw.triggered)

# --- agents + handoff chain -------------------------------------------------
policy_agent = Agent(
    name="Policy", model="gpt-5.4-mini",
    instructions="Apply Reg E. Any provisional-credit claim MUST cite a chunk id.",
    tools=[search_policy],
    input_guardrails=[quarantine_poisoned_guardrail],
    output_guardrails=[reg_e_citation_guardrail],
)
evidence_agent = Agent(
    name="Evidence", model="gpt-5.4-mini",
    instructions="Gather evidence from >=3 source systems and summarize.",
    tools=[fetch_evidence], handoffs=[policy_agent],
)
triage_agent = Agent(
    name="Triage", model="gpt-5.4-mini",
    instructions="Classify Type A/B and Reg E urgency, then hand off to Evidence.",
    handoffs=[evidence_agent],
)

# session persistence + tracing are on by default
session = SQLiteSession(f"dispute-{dispute_id}")
result = await Runner.run(triage_agent, input=prompt, session=session)
'''


def run_pipeline_llm(*args: Any, **kwargs: Any):  # pragma: no cover - needs a key
    """Live path. Intentionally raises until students wire it in W15.

    Keeping this honest (rather than a fake success) is the point: the demo runs
    on the mock brain; the LLM path is the lab deliverable.
    """
    raise NotImplementedError(
        "LLM runtime is the W15 build deliverable. The whole-game demo runs on "
        "the deterministic mock brain (run with --mock, the default). Pass "
        "--show-sdk to print the reference Agents SDK wiring."
    )
