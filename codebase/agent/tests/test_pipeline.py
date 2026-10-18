"""Lab-checkpoint tests (W15 ships these so students self-verify).

These run entirely on the bundled fixture + mock brain — no key, no Postgres.
"""
from datetime import datetime, timezone

import pytest

from meridian_agent.agents import policy as policy_agent
from meridian_agent.db import FixtureRepo
from meridian_agent.guardrail import (
    check_provisional_credit_citation,
    quarantine_poisoned,
)
from meridian_agent.pipeline import run_pipeline
from meridian_agent.trace import Tracer

NOW = datetime(2026, 6, 17, tzinfo=timezone.utc)


@pytest.fixture
def repo():
    return FixtureRepo()


def test_fixture_has_three_disputes(repo):
    assert repo.available_disputes() == ["1", "7", "29"]


def test_pipeline_completes_end_to_end(repo, capsys):
    sc = run_pipeline(repo, "1", tracer=Tracer(), now=NOW)
    assert sc.dispute_id == 1
    assert "Type B" in sc.classification


def test_typeA_breached_routes_to_human(repo):
    sc = run_pipeline(repo, "29", tracer=Tracer(), now=NOW)
    assert sc.classification_correct
    assert "Type A" in sc.classification
    assert sc.routed_to_human  # breached Reg E clock must escalate
    assert sc.handoff_queue == "type_a_approval"


def test_poisoned_chunk_is_quarantined(repo):
    sc = run_pipeline(repo, "29", tracer=Tracer(), now=NOW)
    assert sc.poisoned_quarantined  # chunk 121 dropped before context


def test_guardrail_blocks_uncited_provisional_credit(repo):
    sc = run_pipeline(repo, "29", tracer=Tracer(), now=NOW, demo_tripwire=True)
    assert sc.guardrail_blocked  # uncited PC claim is tripwired


def test_grounded_provisional_credit_passes_guardrail(repo):
    # dispute 29 (Type A, breached) needs PC and the policy chunk is present →
    # the agent cites it and the tripwire does NOT fire.
    sc = run_pipeline(repo, "29", tracer=Tracer(), now=NOW)
    assert not sc.guardrail_blocked
    assert sc.policy_citation_present


# --- unit-level guardrail tests --------------------------------------------
def test_quarantine_drops_poisoned():
    chunks = [
        {"chunk_id": 1, "content": "ok", "is_poisoned": False},
        {"chunk_id": 121, "content": "evil", "is_poisoned": True},
    ]
    q = quarantine_poisoned(chunks)
    assert q.quarantined_ids == [121]
    assert [c["chunk_id"] for c in q.safe_chunks] == [1]


def test_tripwire_blocks_uncited_claim():
    tw = check_provisional_credit_citation(
        "Issue provisional credit within 10 business days.", valid_chunk_ids={1, 2}
    )
    assert tw.triggered


def test_tripwire_passes_cited_claim():
    tw = check_provisional_credit_citation(
        "Issue provisional credit per Reg E [chunk 1].", valid_chunk_ids={1, 2}
    )
    assert not tw.triggered
    assert tw.cited_chunk_ids == [1]


def test_tripwire_rejects_quarantined_citation():
    # citing only the poisoned chunk (121, not in valid set) must still trip.
    tw = check_provisional_credit_citation(
        "Issue provisional credit [chunk 121].", valid_chunk_ids={1, 2}
    )
    assert tw.triggered


def test_tripwire_ignores_non_pc_statements():
    tw = check_provisional_credit_citation(
        "Continue standard investigation.", valid_chunk_ids={1, 2}
    )
    assert not tw.triggered
