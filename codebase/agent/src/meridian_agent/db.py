"""Data access for the Meridian demo.

One contract, two backends:

  * **Postgres** (the live Meridian platform) via `psycopg`, read from
    ``MERIDIAN_DB_URL`` (default ``postgresql://meridian:meridian@localhost:5432/meridian``).
  * **Bundled JSON fixture** — the offline fallback. Used automatically when
    psycopg is not installed OR the DB is unreachable, so the demo *always* runs.

Every public function returns plain dicts/lists with the same shape regardless
of backend. Money stays in integer cents throughout (see schema.sql).
"""
from __future__ import annotations

import json
import os
from importlib import resources
from typing import Any

DEFAULT_DB_URL = "postgresql://meridian:meridian@localhost:5432/meridian"


class DisputeNotFound(Exception):
    pass


# ---------------------------------------------------------------------------
# Fixture backend
# ---------------------------------------------------------------------------
def _load_fixture() -> dict[str, Any]:
    with resources.files("meridian_agent.data").joinpath("fixture.json").open() as fh:
        return json.load(fh)


class FixtureRepo:
    """Reads the bundled JSON. The $0 / no-network / CI path."""

    backend = "fixture"

    def __init__(self) -> None:
        self._data = _load_fixture()

    def available_disputes(self) -> list[str]:
        return sorted(self._data["disputes"].keys(), key=int)

    def get_dispute_bundle(self, dispute_id: str | int) -> dict[str, Any]:
        key = str(dispute_id)
        bundle = self._data["disputes"].get(key)
        if bundle is None:
            raise DisputeNotFound(
                f"dispute {dispute_id} not in fixture; available: "
                f"{', '.join(self.available_disputes())}"
            )
        return bundle

    def get_policy_chunks(self) -> list[dict[str, Any]]:
        # NOTE: poisoned chunks are returned here exactly as the real DB would
        # return them. Quarantine is the *guardrail's* job, not the store's.
        return list(self._data["policy_chunks"])


# ---------------------------------------------------------------------------
# Postgres backend
# ---------------------------------------------------------------------------
class PostgresRepo:
    """Reads the live Meridian Postgres. Same return shapes as FixtureRepo."""

    backend = "postgres"

    def __init__(self, conn) -> None:  # conn: psycopg.Connection
        self._conn = conn

    def available_disputes(self) -> list[str]:
        with self._conn.cursor() as cur:
            cur.execute("SELECT dispute_id FROM meridian.disputes ORDER BY dispute_id LIMIT 25")
            return [str(r[0]) for r in cur.fetchall()]

    def _row(self, cur) -> dict[str, Any] | None:
        cols = [c.name for c in cur.description]
        row = cur.fetchone()
        return dict(zip(cols, row)) if row else None

    def _rows(self, cur) -> list[dict[str, Any]]:
        cols = [c.name for c in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]

    def get_dispute_bundle(self, dispute_id: str | int) -> dict[str, Any]:
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM meridian.disputes WHERE dispute_id = %s", (int(dispute_id),)
            )
            dispute = self._row(cur)
            if dispute is None:
                raise DisputeNotFound(f"dispute {dispute_id} not in Postgres")

            cur.execute(
                "SELECT * FROM meridian.transactions WHERE txn_id = %s", (dispute["txn_id"],)
            )
            txn = self._row(cur)

            cur.execute(
                "SELECT * FROM meridian.customers WHERE customer_id = %s",
                (dispute["customer_id"],),
            )
            customer = self._row(cur)

            merchant = None
            if txn:
                cur.execute(
                    "SELECT * FROM meridian.merchants WHERE merchant_id = %s",
                    (txn["merchant_id"],),
                )
                merchant = self._row(cur)

            cur.execute(
                "SELECT evidence_id, source_system, kind, payload, gathered_at "
                "FROM meridian.dispute_evidence WHERE dispute_id = %s ORDER BY evidence_id",
                (int(dispute_id),),
            )
            evidence = self._rows(cur)

        return {
            "dispute": _jsonify(dispute),
            "transaction": _jsonify(txn),
            "customer": _jsonify(customer),
            "merchant": _jsonify(merchant),
            "evidence": [_jsonify(e) for e in evidence],
        }

    def get_policy_chunks(self) -> list[dict[str, Any]]:
        with self._conn.cursor() as cur:
            # Pull EVERYTHING incl. is_poisoned — the guardrail must see and
            # quarantine the poisoned chunk; we don't silently filter it here.
            cur.execute(
                "SELECT chunk_id, doc_title, section, content, reg_ref, is_poisoned "
                "FROM meridian.policy_chunks "
                "WHERE reg_ref = 'Reg E' OR is_poisoned = true "
                "ORDER BY chunk_id"
            )
            return [_jsonify(r) for r in self._rows(cur)]


def _jsonify(d: dict[str, Any] | None) -> dict[str, Any] | None:
    """Coerce datetimes / Decimals to JSON-friendly scalars for clean printing."""
    if d is None:
        return None
    out: dict[str, Any] = {}
    for k, v in d.items():
        if hasattr(v, "isoformat"):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out


# ---------------------------------------------------------------------------
# Connection / selection
# ---------------------------------------------------------------------------
def connect(prefer_db: bool = True) -> tuple[Any, str | None]:
    """Return ``(repo, note)``.

    Tries Postgres first (unless ``prefer_db`` is False); on any failure falls
    back to the bundled fixture and returns a human-readable note explaining why.
    """
    if not prefer_db:
        return FixtureRepo(), "fixture (forced via --fixture)"

    db_url = os.environ.get("MERIDIAN_DB_URL", DEFAULT_DB_URL)
    try:
        import psycopg  # type: ignore
    except Exception:
        return FixtureRepo(), "fixture (psycopg not installed)"

    try:
        conn = psycopg.connect(db_url, connect_timeout=3)
        # smoke-test the schema
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM meridian.disputes LIMIT 1")
            cur.fetchone()
        return PostgresRepo(conn), None
    except Exception as exc:  # noqa: BLE001 — demo must never crash here
        short = str(exc).splitlines()[0][:80]
        return FixtureRepo(), f"fixture (Postgres unreachable: {short})"
