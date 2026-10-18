-- Meridian Bank — agent-facing API tables (P1+P2)
-- Idempotent (IF NOT EXISTS). Lives in the `meridian` schema alongside schema.sql.
-- Apply AFTER schema.sql:
--   docker exec -i meridian-db psql -U meridian -d meridian < platform/db/api.sql
-- (or to Supabase: psql "<MERIDIAN_DB_URL>" -f platform/db/api.sql)

CREATE SCHEMA IF NOT EXISTS meridian;
SET search_path TO meridian, public;

-- ---------------------------------------------------------------------------
-- API keys. Each key maps to a seeded analyst seat (OBO simulation: the agent
-- acts AS that analyst). The seat carries the scope + learner_id that the API
-- layer enforces on every request. Only the sha256 hash is stored.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS api_keys (
    key_id      BIGSERIAL PRIMARY KEY,
    key_hash    TEXT UNIQUE NOT NULL,
    analyst_id  BIGINT REFERENCES analysts(analyst_id),
    learner_id  TEXT,
    label       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked     BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- ---------------------------------------------------------------------------
-- Idempotency keys for write actions (POST /tickets). Scoped per learner so a
-- replay of the same Idempotency-Key returns the original ticket, never a dupe.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS idempotency_keys (
    learner_id  TEXT,
    idem_key    TEXT,
    ticket_id   BIGINT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (learner_id, idem_key)
);

-- ---------------------------------------------------------------------------
-- Sequence for learner-created ticket ids. Starts high so learner tickets never
-- collide with the seeded canonical ticket id space.
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS meridian.learner_ticket_seq START 9000000000;
