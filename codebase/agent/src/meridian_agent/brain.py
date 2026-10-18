"""The 'brain' seam: where the LLM lives, or doesn't.

This is the single place that decides between:

  * **mock** — deterministic, rule-based stand-ins for every LLM call. No key,
    no network. This is the default and the CI/demo path. Each agent's reasoning
    is a small pure function so the whole-game demo is reproducible on stage.

  * **llm** — the *real* OpenAI Agents SDK + Responses API. Selected only when a
    key is present AND ``--mock`` was not passed. The SDK wiring is isolated in
    ``agents/sdk_runtime.py`` so it never imports unless actually used.

The W15 lesson is exactly this seam: students replace the mock reasoners with
real Agents/Handoffs/Guardrails, and *nothing else in the pipeline changes*.
"""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class BrainConfig:
    mode: str  # "mock" | "llm"
    provider: str  # "none" | "openai" | "azure-foundry"
    model: str | None = None

    @property
    def is_mock(self) -> bool:
        return self.mode == "mock"


def detect_brain(force_mock: bool) -> BrainConfig:
    """Decide which brain to run.

    --mock (force_mock=True) always wins. Otherwise we look for credentials:
      * OPENAI_API_KEY            -> OpenAI Responses API
      * AZURE_OPENAI_API_KEY +
        AZURE_OPENAI_ENDPOINT     -> Microsoft Foundry / Azure OpenAI
    With no credentials we fall back to mock so the demo always runs.
    """
    if force_mock:
        return BrainConfig(mode="mock", provider="none")

    if os.environ.get("AZURE_OPENAI_API_KEY") and os.environ.get("AZURE_OPENAI_ENDPOINT"):
        return BrainConfig(
            mode="llm",
            provider="azure-foundry",
            model=os.environ.get("MERIDIAN_MODEL", "gpt-5.4-mini"),
        )
    if os.environ.get("OPENAI_API_KEY"):
        return BrainConfig(
            mode="llm",
            provider="openai",
            model=os.environ.get("MERIDIAN_MODEL", "gpt-5.4-mini"),
        )

    # No key anywhere — graceful default.
    return BrainConfig(mode="mock", provider="none")
