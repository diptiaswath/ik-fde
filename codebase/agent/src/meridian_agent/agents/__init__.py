"""The Meridian agent pipeline.

Four cooperating agents, run in sequence against one dispute id:

    triage  →(handoff)→  evidence  →  policy(+guardrails)  →  human-handoff

Each module exposes a ``run(...)`` function. In --mock mode the reasoning is a
deterministic rule-based stand-in; the real OpenAI Agents SDK version lives in
``sdk_runtime`` and is wired in at the same call sites (see brain.py).
"""
