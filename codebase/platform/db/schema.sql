-- Meridian Bank — canonical schema (core engagement surface)
-- Postgres 15+. Feeds both the hosted Supabase platform and the local fallback.
-- The engagement's problems are baked into the DATA (see seed/), not described here.
--
-- Phases: P0/P1 use the `meridian` schema below. RLS policies (W16) live in rls.sql.
-- The W19 text-to-SQL warehouse (`warehouse` schema, 40/900 tables) is generated
-- separately in P4 — intentionally not here, to keep the first-two-weeks build lean.

CREATE SCHEMA IF NOT EXISTS meridian;
SET search_path TO meridian, public;

-- ---------------------------------------------------------------------------
-- People & accounts
-- ---------------------------------------------------------------------------

CREATE TABLE customers (
    customer_id   BIGINT PRIMARY KEY,
    full_name     TEXT        NOT NULL,
    email         TEXT        NOT NULL,
    date_of_birth DATE        NOT NULL,
    segment       TEXT        NOT NULL,             -- retail | premier | small_business
    joined_at     TIMESTAMPTZ NOT NULL,
    -- legacy_code: cryptic CRM migration artifact; trips up naive joins (W19 ugly)
    legacy_code   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
    account_id          BIGINT PRIMARY KEY,
    customer_id         BIGINT NOT NULL REFERENCES customers(customer_id),
    account_type        TEXT   NOT NULL,            -- debit | checking | savings
    opened_at           TIMESTAMPTZ NOT NULL,
    status              TEXT   NOT NULL DEFAULT 'active',  -- active | frozen | closed
    -- from_acquired_portfolio: the debit-card book Meridian bought; origin of the
    -- dispute spike in the story. ~30% of accounts.
    from_acquired_portfolio BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_accounts_customer ON accounts(customer_id);

CREATE TABLE merchants (
    merchant_id  BIGINT PRIMARY KEY,
    name         TEXT NOT NULL,
    category     TEXT NOT NULL,
    mcc          TEXT NOT NULL,                     -- merchant category code
    country      TEXT NOT NULL DEFAULT 'US',
    -- risk_status: a few merchants are 'watch'/'bad' → the W18 counterparty hook
    risk_status  TEXT NOT NULL DEFAULT 'good'       -- good | watch | bad
);
CREATE INDEX idx_merchants_risk ON merchants(risk_status);

-- ---------------------------------------------------------------------------
-- Transactions — the "millions of rows" table (P1 loads ~5M)
-- ---------------------------------------------------------------------------

CREATE TABLE transactions (
    txn_id       BIGINT PRIMARY KEY,
    account_id   BIGINT NOT NULL REFERENCES accounts(account_id),
    merchant_id  BIGINT NOT NULL REFERENCES merchants(merchant_id),
    amount_cents BIGINT NOT NULL,                   -- store money as integer cents
    currency     TEXT   NOT NULL DEFAULT 'USD',
    txn_ts       TIMESTAMPTZ NOT NULL,
    channel      TEXT   NOT NULL,                   -- pos | online | atm | recurring
    mcc          TEXT   NOT NULL,
    status       TEXT   NOT NULL DEFAULT 'settled', -- settled | pending | reversed
    is_disputed  BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_txn_account ON transactions(account_id);
CREATE INDEX idx_txn_ts ON transactions(txn_ts);
CREATE INDEX idx_txn_merchant ON transactions(merchant_id);
CREATE INDEX idx_txn_disputed ON transactions(is_disputed) WHERE is_disputed;

-- ---------------------------------------------------------------------------
-- Disputes — the heart of the engagement. Problems live here.
-- ---------------------------------------------------------------------------

CREATE TABLE disputes (
    dispute_id        BIGINT PRIMARY KEY,
    txn_id            BIGINT NOT NULL REFERENCES transactions(txn_id),
    customer_id       BIGINT NOT NULL REFERENCES customers(customer_id),
    -- dispute_type: the RBAC scoping axis (W16). Type A = card fraud/unauthorized;
    -- Type B = merchant/quality (billing, not-as-described). Analysts are scoped to one.
    dispute_type      TEXT NOT NULL,                -- A | B
    reason_code       TEXT NOT NULL,                -- e.g. 10.4, 13.1 (card-network style)
    status            TEXT NOT NULL,                -- intake | investigating | provisional_credit | resolved | denied
    opened_at         TIMESTAMPTZ NOT NULL,
    -- reg_e_due_at: the hard 10-business-day clock. The teachable SLA.
    reg_e_due_at      TIMESTAMPTZ NOT NULL,
    -- sla_breached: ~12% TRUE = the visible pain Marcus complains about.
    sla_breached      BOOLEAN NOT NULL DEFAULT FALSE,
    provisional_credit_issued BOOLEAN NOT NULL DEFAULT FALSE,
    provisional_credit_cents  BIGINT,
    -- provisional_credit_error: seeded errors costing real money (story pain).
    provisional_credit_error  BOOLEAN NOT NULL DEFAULT FALSE,
    -- assigned_analyst_id FK is added via ALTER below (analysts is defined later).
    assigned_analyst_id BIGINT,
    resolution        TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_disputes_type ON disputes(dispute_type);
CREATE INDEX idx_disputes_breach ON disputes(sla_breached) WHERE sla_breached;
CREATE INDEX idx_disputes_due ON disputes(reg_e_due_at);

CREATE TABLE dispute_evidence (
    evidence_id   BIGINT PRIMARY KEY,
    dispute_id    BIGINT NOT NULL REFERENCES disputes(dispute_id),
    -- source_system: evidence is scattered across systems — the W15 Evidence agent
    -- must gather from >=3 of these. This is why disputes are genuinely agentic.
    source_system TEXT NOT NULL,                    -- core_banking | servicenow | sharepoint | card_network
    kind          TEXT NOT NULL,                    -- txn_detail | customer_note | policy_ref | merchant_response
    payload       JSONB NOT NULL,
    gathered_at   TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_evidence_dispute ON dispute_evidence(dispute_id);

-- ---------------------------------------------------------------------------
-- Tickets (ServiceNow-style). Duplicate disputes hide here.
-- ---------------------------------------------------------------------------

CREATE TABLE tickets (
    ticket_id     BIGINT PRIMARY KEY,
    dispute_id    BIGINT REFERENCES disputes(dispute_id),
    customer_id   BIGINT NOT NULL REFERENCES customers(customer_id),
    channel       TEXT NOT NULL,                    -- phone | email | branch | chat
    subject       TEXT NOT NULL,
    body          TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'open',     -- open | pending | closed
    is_duplicate  BOOLEAN NOT NULL DEFAULT FALSE,
    duplicate_of  BIGINT REFERENCES tickets(ticket_id),
    created_at    TIMESTAMPTZ NOT NULL,
    -- learner_id: tickets the student's agent CREATES carry their id (write-scoping).
    -- NULL = canonical seeded ticket (shared, read-only).
    learner_id    TEXT
);
CREATE INDEX idx_tickets_dispute ON tickets(dispute_id);
CREATE INDEX idx_tickets_learner ON tickets(learner_id);

-- ---------------------------------------------------------------------------
-- Policy KB (RAG source, W15). One chunk is poisoned (W16 incident / W17 safety eval).
-- ---------------------------------------------------------------------------

CREATE TABLE policy_chunks (
    chunk_id     BIGINT PRIMARY KEY,
    doc_title    TEXT NOT NULL,
    section      TEXT NOT NULL,
    content      TEXT NOT NULL,
    reg_ref      TEXT,                              -- Reg E | GLBA | SOC2 | internal
    -- is_poisoned: exactly ONE chunk carries a prompt-injection. Do not surface in UI.
    is_poisoned  BOOLEAN NOT NULL DEFAULT FALSE
);

-- ---------------------------------------------------------------------------
-- Analysts = the platform's users. Mapped to learner credentials + RBAC scope.
-- ---------------------------------------------------------------------------

CREATE TABLE analysts (
    analyst_id     BIGINT PRIMARY KEY,
    full_name      TEXT NOT NULL,
    email          TEXT NOT NULL UNIQUE,
    -- scope: drives RLS in W16. type_a / type_b analysts see only their dispute type.
    scope          TEXT NOT NULL DEFAULT 'all',     -- type_a | type_b | all
    role           TEXT NOT NULL DEFAULT 'analyst',  -- analyst | lead | admin
    is_learner_seat BOOLEAN NOT NULL DEFAULT FALSE,
    learner_id     TEXT,                            -- maps to the student's repo/credentials
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Late FK now that analysts exists (disputes.assigned_analyst_id declared above).
ALTER TABLE disputes
    ADD CONSTRAINT fk_disputes_analyst
    FOREIGN KEY (assigned_analyst_id) REFERENCES analysts(analyst_id);

-- ---------------------------------------------------------------------------
-- Audit log — every agent tool call writes here (W16 RBAC, made visible).
-- ---------------------------------------------------------------------------

CREATE TABLE audit_log (
    audit_id      BIGSERIAL PRIMARY KEY,
    analyst_id    BIGINT REFERENCES analysts(analyst_id),
    learner_id    TEXT,
    action        TEXT NOT NULL,                    -- lookup_dispute | fetch_transactions | create_ticket | search_policy
    resource_type TEXT,
    resource_id   TEXT,
    scope         TEXT,
    decision      TEXT NOT NULL,                    -- allow | deny
    detail        JSONB,
    ts            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_analyst ON audit_log(analyst_id);
CREATE INDEX idx_audit_ts ON audit_log(ts);

-- ---------------------------------------------------------------------------
-- Convenience views for the Ops Console (read path)
-- ---------------------------------------------------------------------------

CREATE VIEW dispute_queue AS
SELECT
    d.dispute_id,
    d.dispute_type,
    d.reason_code,
    d.status,
    d.opened_at,
    d.reg_e_due_at,
    d.sla_breached,
    -- hours_to_deadline drives the red/amber/green timers in the queue UI
    EXTRACT(EPOCH FROM (d.reg_e_due_at - now())) / 3600.0 AS hours_to_deadline,
    c.full_name      AS customer_name,
    t.amount_cents,
    m.name           AS merchant_name,
    m.risk_status    AS merchant_risk,
    a.full_name      AS assigned_analyst
FROM disputes d
JOIN customers c   ON c.customer_id = d.customer_id
JOIN transactions t ON t.txn_id = d.txn_id
JOIN merchants m   ON m.merchant_id = t.merchant_id
LEFT JOIN analysts a ON a.analyst_id = d.assigned_analyst_id;

COMMENT ON SCHEMA meridian IS 'Meridian Bank canonical engagement data. Problems are seeded into the rows, not documented in DDL.';
