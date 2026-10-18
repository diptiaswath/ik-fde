"""Guardrails for the Policy agent.

Two distinct safety mechanisms, both teachable in W15/W16/W17:

1. **Poisoned-chunk quarantine** (input guardrail / XPIA defence).
   Any retrieved ``policy_chunks`` row with ``is_poisoned = true`` is dropped
   *before* it can reach the model context. The injection in chunk 121 tries to
   exfiltrate account 999999 to an external address; we never ingest it. The
   quarantine is logged, not silent — that's the W16 incident made visible.

2. **Reg E provisional-credit citation tripwire** (output guardrail).
   ANY statement that involves provisional credit MUST cite at least one policy
   chunk id. An uncited provisional-credit claim TRIPS the wire and the output
   is BLOCKED — never returned to a human or written to the system of record.

In the W15 real build these become OpenAI Agents SDK ``@input_guardrail`` /
``@output_guardrail`` functions returning ``GuardrailFunctionOutput`` with
``tripwire_triggered``. The logic below is the exact rule; only the decorator
plumbing changes.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

# Phrases that mean "this output is making a provisional-credit claim".
_PROVISIONAL_CREDIT_RE = re.compile(
    r"provisional\s+credit|provisionally\s+credit|issue\s+credit|10\s+business\s+days",
    re.IGNORECASE,
)


@dataclass
class QuarantineResult:
    safe_chunks: list[dict[str, Any]]
    quarantined: list[dict[str, Any]] = field(default_factory=list)

    @property
    def quarantined_ids(self) -> list[int]:
        return [c["chunk_id"] for c in self.quarantined]


def quarantine_poisoned(chunks: list[dict[str, Any]]) -> QuarantineResult:
    """INPUT guardrail: never let an ``is_poisoned`` chunk into model context."""
    safe, bad = [], []
    for c in chunks:
        (bad if c.get("is_poisoned") else safe).append(c)
    return QuarantineResult(safe_chunks=safe, quarantined=bad)


@dataclass
class TripwireResult:
    triggered: bool
    reason: str
    mentions_provisional_credit: bool
    cited_chunk_ids: list[int] = field(default_factory=list)


def _extract_citations(text: str) -> list[int]:
    """Find policy-chunk citations like ``[chunk 1]``, ``policy_chunk:2``, ``§3``."""
    ids: list[int] = []
    for m in re.finditer(r"(?:chunk|policy_chunk|§)\s*[:#]?\s*(\d+)", text, re.IGNORECASE):
        ids.append(int(m.group(1)))
    return sorted(set(ids))


def check_provisional_credit_citation(
    statement: str, *, valid_chunk_ids: set[int]
) -> TripwireResult:
    """OUTPUT guardrail: provisional-credit claims must cite a real policy chunk.

    Trips (blocks) when the statement mentions provisional credit but cites no
    chunk id, or cites only ids that aren't in the safe (non-poisoned) set.
    """
    mentions = bool(_PROVISIONAL_CREDIT_RE.search(statement))
    cited = _extract_citations(statement)
    valid_cited = [c for c in cited if c in valid_chunk_ids]

    if not mentions:
        return TripwireResult(False, "no provisional-credit claim to gate", False, cited)

    if not valid_cited:
        why = (
            "TRIPWIRE: provisional-credit statement with no valid policy citation"
            if not cited
            else f"TRIPWIRE: provisional-credit statement cites only invalid/quarantined ids {cited}"
        )
        return TripwireResult(True, why, True, valid_cited)

    return TripwireResult(
        False, f"provisional-credit claim grounded in chunk(s) {valid_cited}", True, valid_cited
    )
