import { query, queryOne } from "./db";

// ---------------------------------------------------------------------------
// Types mirroring the meridian schema (only the columns the UI reads).
// ---------------------------------------------------------------------------

export type Analyst = {
  analyst_id: number;
  full_name: string;
  email: string;
  scope: string;
  role: string;
};

export type QueueRow = {
  dispute_id: string;
  dispute_type: string;
  reason_code: string;
  status: string;
  opened_at: string;
  reg_e_due_at: string;
  sla_breached: boolean;
  hours_to_deadline: number | null;
  customer_name: string;
  amount_cents: string;
  merchant_name: string;
  merchant_risk: string;
  assigned_analyst: string | null;
};

export type QueueStats = {
  total_open: number;
  breached: number;
};

export type DisputeDetail = {
  dispute_id: string;
  txn_id: string;
  customer_id: string;
  dispute_type: string;
  reason_code: string;
  status: string;
  opened_at: string;
  reg_e_due_at: string;
  sla_breached: boolean;
  provisional_credit_issued: boolean;
  provisional_credit_cents: string | null;
  provisional_credit_error: boolean;
  resolution: string | null;
  assigned_analyst: string | null;
  // joined txn
  amount_cents: string;
  currency: string;
  txn_ts: string;
  channel: string;
  txn_status: string;
  account_id: string;
  // joined customer
  customer_name: string;
  customer_email: string;
  customer_segment: string;
  // joined merchant
  merchant_name: string;
  merchant_category: string;
  merchant_risk: string;
  merchant_country: string;
};

export type EvidenceRow = {
  evidence_id: string;
  source_system: string;
  kind: string;
  payload: unknown;
  gathered_at: string;
};

export type TicketRow = {
  ticket_id: string;
  dispute_id: string | null;
  channel: string;
  subject: string;
  body: string;
  status: string;
  is_duplicate: boolean;
  duplicate_of: string | null;
  created_at: string;
};

export type TxnRow = {
  txn_id: string;
  account_id: string;
  amount_cents: string;
  currency: string;
  txn_ts: string;
  channel: string;
  mcc: string;
  status: string;
  is_disputed: boolean;
  merchant_name: string;
  merchant_risk: string;
};

export type CustomerProfile = {
  customer_id: string;
  full_name: string;
  email: string;
  date_of_birth: string;
  segment: string;
  joined_at: string;
};

export type AccountRow = {
  account_id: string;
  account_type: string;
  status: string;
  opened_at: string;
  from_acquired_portfolio: boolean;
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

// NOTE: analyst_id is BIGINT; node-postgres returns BIGINT as a *string*. Cast to
// int so it arrives as a JS number (analyst ids are small, well within int range).
export function findAnalystByEmail(email: string): Promise<Analyst | null> {
  return queryOne<Analyst>(
    `SELECT analyst_id::int AS analyst_id, full_name, email, scope, role
       FROM meridian.analysts
      WHERE lower(email) = lower($1)
      LIMIT 1`,
    [email]
  );
}

export function sampleAnalysts(limit = 3): Promise<Analyst[]> {
  return query<Analyst>(
    `SELECT analyst_id::int AS analyst_id, full_name, email, scope, role
       FROM meridian.analysts
      ORDER BY analyst_id
      LIMIT $1`,
    [limit]
  );
}

// ---------------------------------------------------------------------------
// Dispute queue (the hero)
// ---------------------------------------------------------------------------

// "Open" = anything not yet resolved/denied.
const OPEN_STATUSES = ["intake", "investigating", "provisional_credit"];

/**
 * Queue ordered by urgency. Scope-aware: type_a/type_b analysts only see their
 * dispute type; "all" / lead / admin see everything.
 */
export function getQueue(opts: {
  scope: string;
  limit?: number;
  status?: string; // a single OPEN status to filter to (validated by caller)
  breachedOnly?: boolean;
  type?: string; // 'A' | 'B' — only honored when scope is "all"/lead/admin
}): Promise<QueueRow[]> {
  const limit = opts.limit ?? 200;
  const scopeType = scopeToType(opts.scope);
  // Scope wins over the type filter so a scoped analyst can never widen access.
  const effectiveType =
    scopeType ?? (opts.type === "A" || opts.type === "B" ? opts.type : null);
  const statusFilter =
    opts.status && OPEN_STATUSES.includes(opts.status) ? opts.status : null;
  return query<QueueRow>(
    `SELECT dispute_id, dispute_type, reason_code, status, opened_at,
            reg_e_due_at, sla_breached, hours_to_deadline,
            customer_name, amount_cents, merchant_name, merchant_risk,
            assigned_analyst
       FROM meridian.dispute_queue
      WHERE status = ANY($1)
        AND ($2::text IS NULL OR dispute_type = $2)
        AND ($3::text IS NULL OR status = $3)
        AND ($4::boolean IS FALSE OR sla_breached = TRUE)
      ORDER BY hours_to_deadline ASC NULLS LAST
      LIMIT $5`,
    [OPEN_STATUSES, effectiveType, statusFilter, opts.breachedOnly ?? false, limit]
  );
}

export async function getQueueStats(scope: string): Promise<QueueStats> {
  const scopeType = scopeToType(scope);
  const row = await queryOne<{ total_open: string; breached: string }>(
    `SELECT count(*) AS total_open,
            count(*) FILTER (WHERE sla_breached) AS breached
       FROM meridian.dispute_queue
      WHERE status = ANY($1)
        AND ($2::text IS NULL OR dispute_type = $2)`,
    [OPEN_STATUSES, scopeType]
  );
  return {
    total_open: Number(row?.total_open ?? 0),
    breached: Number(row?.breached ?? 0),
  };
}

export function scopeToType(scope: string): string | null {
  if (scope === "type_a") return "A";
  if (scope === "type_b") return "B";
  return null; // all / lead / admin
}

// ---------------------------------------------------------------------------
// Dispute detail
// ---------------------------------------------------------------------------

export function getDispute(id: string): Promise<DisputeDetail | null> {
  return queryOne<DisputeDetail>(
    `SELECT d.dispute_id, d.txn_id, d.customer_id, d.dispute_type, d.reason_code,
            d.status, d.opened_at, d.reg_e_due_at, d.sla_breached,
            d.provisional_credit_issued, d.provisional_credit_cents,
            d.provisional_credit_error, d.resolution,
            an.full_name AS assigned_analyst,
            t.amount_cents, t.currency, t.txn_ts, t.channel,
            t.status AS txn_status, t.account_id,
            c.full_name AS customer_name, c.email AS customer_email,
            c.segment AS customer_segment,
            m.name AS merchant_name, m.category AS merchant_category,
            m.risk_status AS merchant_risk, m.country AS merchant_country
       FROM meridian.disputes d
       JOIN meridian.transactions t ON t.txn_id = d.txn_id
       JOIN meridian.customers c ON c.customer_id = d.customer_id
       JOIN meridian.merchants m ON m.merchant_id = t.merchant_id
       LEFT JOIN meridian.analysts an ON an.analyst_id = d.assigned_analyst_id
      WHERE d.dispute_id = $1
      LIMIT 1`,
    [id]
  );
}

export function getEvidence(disputeId: string): Promise<EvidenceRow[]> {
  return query<EvidenceRow>(
    `SELECT evidence_id, source_system, kind, payload, gathered_at
       FROM meridian.dispute_evidence
      WHERE dispute_id = $1
      ORDER BY gathered_at ASC
      LIMIT 100`,
    [disputeId]
  );
}

export function getDisputeTickets(disputeId: string): Promise<TicketRow[]> {
  return query<TicketRow>(
    `SELECT ticket_id, dispute_id, channel, subject, body, status,
            is_duplicate, duplicate_of, created_at
       FROM meridian.tickets
      WHERE dispute_id = $1
      ORDER BY created_at DESC
      LIMIT 50`,
    [disputeId]
  );
}

// ---------------------------------------------------------------------------
// Transaction explorer (must stay fast — always LIMIT, filter on indexed cols)
// ---------------------------------------------------------------------------

export function getTransactions(opts: {
  accountId?: string;
  limit: number;
  offset: number;
}): Promise<TxnRow[]> {
  const accountId = opts.accountId?.trim() || null;
  return query<TxnRow>(
    `SELECT t.txn_id, t.account_id, t.amount_cents, t.currency, t.txn_ts,
            t.channel, t.mcc, t.status, t.is_disputed,
            m.name AS merchant_name, m.risk_status AS merchant_risk
       FROM meridian.transactions t
       JOIN meridian.merchants m ON m.merchant_id = t.merchant_id
      WHERE ($1::bigint IS NULL OR t.account_id = $1::bigint)
      ORDER BY t.txn_ts DESC
      LIMIT $2 OFFSET $3`,
    [accountId, opts.limit, opts.offset]
  );
}

// ---------------------------------------------------------------------------
// Customer 360
// ---------------------------------------------------------------------------

export function getCustomer(id: string): Promise<CustomerProfile | null> {
  return queryOne<CustomerProfile>(
    `SELECT customer_id, full_name, email, date_of_birth, segment, joined_at
       FROM meridian.customers
      WHERE customer_id = $1
      LIMIT 1`,
    [id]
  );
}

export function getCustomerAccounts(id: string): Promise<AccountRow[]> {
  return query<AccountRow>(
    `SELECT account_id, account_type, status, opened_at, from_acquired_portfolio
       FROM meridian.accounts
      WHERE customer_id = $1
      ORDER BY opened_at ASC
      LIMIT 50`,
    [id]
  );
}

export function getCustomerTransactions(id: string): Promise<TxnRow[]> {
  return query<TxnRow>(
    `SELECT t.txn_id, t.account_id, t.amount_cents, t.currency, t.txn_ts,
            t.channel, t.mcc, t.status, t.is_disputed,
            m.name AS merchant_name, m.risk_status AS merchant_risk
       FROM meridian.transactions t
       JOIN meridian.accounts a ON a.account_id = t.account_id
       JOIN meridian.merchants m ON m.merchant_id = t.merchant_id
      WHERE a.customer_id = $1
      ORDER BY t.txn_ts DESC
      LIMIT 25`,
    [id]
  );
}

export type CustomerDisputeRow = {
  dispute_id: string;
  dispute_type: string;
  status: string;
  reason_code: string;
  sla_breached: boolean;
  opened_at: string;
  reg_e_due_at: string;
  amount_cents: string;
  merchant_name: string;
};

export function getCustomerDisputes(id: string): Promise<CustomerDisputeRow[]> {
  return query<CustomerDisputeRow>(
    `SELECT d.dispute_id, d.dispute_type, d.status, d.reason_code,
            d.sla_breached, d.opened_at, d.reg_e_due_at,
            t.amount_cents, m.name AS merchant_name
       FROM meridian.disputes d
       JOIN meridian.transactions t ON t.txn_id = d.txn_id
       JOIN meridian.merchants m ON m.merchant_id = t.merchant_id
      WHERE d.customer_id = $1
      ORDER BY d.opened_at DESC
      LIMIT 50`,
    [id]
  );
}

// ---------------------------------------------------------------------------
// Dashboard aggregates — all scope-aware (type_a/type_b see only their type),
// parameterized, and LIMITed. These feed the KPI cards, charts and panels.
// ---------------------------------------------------------------------------

export type DashboardKpis = {
  total_open: number;
  breached: number;
  resolved: number;
  denied: number;
  recovery_wins: number; // refunded / merchant_credit
  provisional_outstanding_cents: number;
  avg_hours_to_due: number | null;
};

export async function getDashboardKpis(scope: string): Promise<DashboardKpis> {
  const t = scopeToType(scope);
  const row = await queryOne<{
    total_open: string;
    breached: string;
    resolved: string;
    denied: string;
    recovery_wins: string;
    provisional_outstanding_cents: string;
    avg_hours_to_due: string | null;
  }>(
    `SELECT
        count(*) FILTER (WHERE status = ANY($1)) AS total_open,
        count(*) FILTER (WHERE status = ANY($1) AND sla_breached) AS breached,
        count(*) FILTER (WHERE status = 'resolved') AS resolved,
        count(*) FILTER (WHERE status = 'denied') AS denied,
        count(*) FILTER (WHERE resolution IN ('refunded','merchant_credit')) AS recovery_wins,
        coalesce(sum(provisional_credit_cents) FILTER (
          WHERE provisional_credit_issued AND status = ANY($1)), 0)
          AS provisional_outstanding_cents,
        avg(EXTRACT(EPOCH FROM (reg_e_due_at - now())) / 3600.0)
          FILTER (WHERE status = ANY($1)) AS avg_hours_to_due
       FROM meridian.disputes
      WHERE ($2::text IS NULL OR dispute_type = $2)`,
    [OPEN_STATUSES, t]
  );
  return {
    total_open: Number(row?.total_open ?? 0),
    breached: Number(row?.breached ?? 0),
    resolved: Number(row?.resolved ?? 0),
    denied: Number(row?.denied ?? 0),
    recovery_wins: Number(row?.recovery_wins ?? 0),
    provisional_outstanding_cents: Number(
      row?.provisional_outstanding_cents ?? 0
    ),
    avg_hours_to_due:
      row?.avg_hours_to_due != null ? Number(row.avg_hours_to_due) : null,
  };
}

export type DayPoint = { day: string; opened: number };

export function getDisputesOpenedPerDay(scope: string): Promise<DayPoint[]> {
  const t = scopeToType(scope);
  return query<DayPoint>(
    `SELECT to_char(date_trunc('day', opened_at), 'Mon DD') AS day,
            count(*)::int AS opened
       FROM meridian.disputes
      WHERE opened_at >= now() - interval '30 days'
        AND ($1::text IS NULL OR dispute_type = $1)
      GROUP BY date_trunc('day', opened_at)
      ORDER BY date_trunc('day', opened_at) ASC
      LIMIT 40`,
    [t]
  );
}

export type TypeSplit = { name: string; value: number };

export function getDisputesByType(scope: string): Promise<TypeSplit[]> {
  const t = scopeToType(scope);
  return query<TypeSplit>(
    `SELECT CASE dispute_type WHEN 'A' THEN 'Type A · Fraud'
                              WHEN 'B' THEN 'Type B · Merchant'
                              ELSE dispute_type END AS name,
            count(*)::int AS value
       FROM meridian.disputes
      WHERE status = ANY($1)
        AND ($2::text IS NULL OR dispute_type = $2)
      GROUP BY dispute_type
      ORDER BY value DESC
      LIMIT 10`,
    [OPEN_STATUSES, t]
  );
}

export type StatusSplit = { status: string; value: number };

export function getDisputesByStatus(scope: string): Promise<StatusSplit[]> {
  const t = scopeToType(scope);
  return query<StatusSplit>(
    `SELECT status, count(*)::int AS value
       FROM meridian.disputes
      WHERE ($1::text IS NULL OR dispute_type = $1)
      GROUP BY status
      LIMIT 10`,
    [t]
  );
}

export type MerchantVolume = { name: string; value: number; risk: string };

export function getTopMerchantsByDisputes(
  scope: string
): Promise<MerchantVolume[]> {
  const t = scopeToType(scope);
  return query<MerchantVolume>(
    `SELECT m.name AS name, count(*)::int AS value,
            m.risk_status AS risk
       FROM meridian.disputes d
       JOIN meridian.transactions t ON t.txn_id = d.txn_id
       JOIN meridian.merchants m ON m.merchant_id = t.merchant_id
      WHERE d.status = ANY($1)
        AND ($2::text IS NULL OR d.dispute_type = $2)
      GROUP BY m.merchant_id, m.name, m.risk_status
      ORDER BY value DESC
      LIMIT 8`,
    [OPEN_STATUSES, t]
  );
}

export type RiskExposure = {
  risk: string;
  dispute_count: number;
  exposure_cents: number;
};

export function getRiskExposure(scope: string): Promise<RiskExposure[]> {
  const t = scopeToType(scope);
  return query<RiskExposure>(
    `SELECT m.risk_status AS risk,
            count(*)::int AS dispute_count,
            coalesce(sum(t.amount_cents),0)::bigint AS exposure_cents
       FROM meridian.disputes d
       JOIN meridian.transactions t ON t.txn_id = d.txn_id
       JOIN meridian.merchants m ON m.merchant_id = t.merchant_id
      WHERE d.status = ANY($1)
        AND m.risk_status IN ('watch','bad')
        AND ($2::text IS NULL OR d.dispute_type = $2)
      GROUP BY m.risk_status
      LIMIT 5`,
    [OPEN_STATUSES, t]
  );
}

// "Needs attention" — most-overdue / most-urgent OPEN disputes, scoped.
export function getNeedsAttention(scope: string): Promise<QueueRow[]> {
  const t = scopeToType(scope);
  return query<QueueRow>(
    `SELECT dispute_id, dispute_type, reason_code, status, opened_at,
            reg_e_due_at, sla_breached, hours_to_deadline,
            customer_name, amount_cents, merchant_name, merchant_risk,
            assigned_analyst
       FROM meridian.dispute_queue
      WHERE status = ANY($1)
        AND ($2::text IS NULL OR dispute_type = $2)
      ORDER BY hours_to_deadline ASC NULLS LAST
      LIMIT 6`,
    [OPEN_STATUSES, t]
  );
}

export type ActivityRow = {
  dispute_id: string;
  dispute_type: string;
  status: string;
  reason_code: string;
  opened_at: string;
  customer_name: string;
  amount_cents: string;
  merchant_name: string;
  merchant_risk: string;
};

export function getRecentActivity(scope: string): Promise<ActivityRow[]> {
  const t = scopeToType(scope);
  return query<ActivityRow>(
    `SELECT d.dispute_id, d.dispute_type, d.status, d.reason_code, d.opened_at,
            c.full_name AS customer_name, t.amount_cents,
            m.name AS merchant_name, m.risk_status AS merchant_risk
       FROM meridian.disputes d
       JOIN meridian.customers c ON c.customer_id = d.customer_id
       JOIN meridian.transactions t ON t.txn_id = d.txn_id
       JOIN meridian.merchants m ON m.merchant_id = t.merchant_id
      WHERE ($1::text IS NULL OR d.dispute_type = $1)
      ORDER BY d.opened_at DESC
      LIMIT 8`,
    [t]
  );
}

// ---------------------------------------------------------------------------
// Policy KB — NEVER surface poisoned chunks (is_poisoned = true).
// ---------------------------------------------------------------------------

export type PolicyChunk = {
  chunk_id: string;
  doc_title: string;
  section: string;
  content: string;
  reg_ref: string | null;
};

// Customers index — those with the most dispute activity, scope-aware.
export type CustomerSummary = {
  customer_id: string;
  full_name: string;
  email: string;
  segment: string;
  dispute_count: number;
  breached_count: number;
};

export function getCustomersWithDisputes(
  scope: string
): Promise<CustomerSummary[]> {
  const t = scopeToType(scope);
  return query<CustomerSummary>(
    `SELECT c.customer_id, c.full_name, c.email, c.segment,
            count(*)::int AS dispute_count,
            count(*) FILTER (WHERE d.sla_breached)::int AS breached_count
       FROM meridian.disputes d
       JOIN meridian.customers c ON c.customer_id = d.customer_id
      WHERE ($1::text IS NULL OR d.dispute_type = $1)
      GROUP BY c.customer_id, c.full_name, c.email, c.segment
      ORDER BY breached_count DESC, dispute_count DESC
      LIMIT 50`,
    [t]
  );
}

export function getPolicyChunks(): Promise<PolicyChunk[]> {
  return query<PolicyChunk>(
    `SELECT chunk_id, doc_title, section, content, reg_ref
       FROM meridian.policy_chunks
      WHERE is_poisoned = false
      ORDER BY doc_title ASC, chunk_id ASC
      LIMIT 500`
  );
}

/**
 * Full-text-ish policy search for the agent retrieval path. ILIKE over title /
 * section / content. NEVER surfaces the poisoned chunk.
 * W16 incident note: the incident-injection hook flips `is_poisoned = false` to
 * include the poisoned chunk in the agent retrieval path, demonstrating a
 * prompt-injection reaching the model. The UI/read path here stays clean.
 */
export function searchPolicies(opts: {
  q?: string;
  limit: number;
}): Promise<PolicyChunk[]> {
  const q = opts.q?.trim() || null;
  return query<PolicyChunk>(
    `SELECT chunk_id, doc_title, section, content, reg_ref
       FROM meridian.policy_chunks
      WHERE is_poisoned = false
        AND ($1::text IS NULL
             OR content ILIKE '%' || $1 || '%'
             OR section ILIKE '%' || $1 || '%'
             OR doc_title ILIKE '%' || $1 || '%')
      ORDER BY doc_title ASC, chunk_id ASC
      LIMIT $2`,
    [q, opts.limit]
  );
}

// ---------------------------------------------------------------------------
// Scope enforcement helpers used by the agent-facing API layer
// ---------------------------------------------------------------------------

/** Just the dispute_type for a dispute id, for cheap scope checks before a read. */
export function getDisputeTypeById(
  id: string
): Promise<{ dispute_type: string; customer_id: string } | null> {
  return queryOne<{ dispute_type: string; customer_id: string }>(
    `SELECT dispute_type, customer_id
       FROM meridian.disputes
      WHERE dispute_id = $1
      LIMIT 1`,
    [id]
  );
}

// ---------------------------------------------------------------------------
// Learner ticket writes (the human-handoff action) + idempotency
// ---------------------------------------------------------------------------

export type CreatedTicket = {
  ticket_id: string;
  dispute_id: string | null;
  customer_id: string;
  channel: string;
  subject: string;
  body: string;
  status: string;
  is_duplicate: boolean;
  duplicate_of: string | null;
  created_at: string;
  learner_id: string | null;
};

/** Look up a ticket by id (used to replay an idempotent ticket create). */
export function getTicketById(id: string): Promise<CreatedTicket | null> {
  return queryOne<CreatedTicket>(
    `SELECT ticket_id, dispute_id, customer_id, channel, subject, body, status,
            is_duplicate, duplicate_of, created_at, learner_id
       FROM meridian.tickets
      WHERE ticket_id = $1
      LIMIT 1`,
    [id]
  );
}

/** Returns a prior ticket id if this (learner_id, idem_key) was already used. */
export async function findIdempotentTicket(
  learnerId: string,
  idemKey: string
): Promise<string | null> {
  const row = await queryOne<{ ticket_id: string }>(
    `SELECT ticket_id
       FROM meridian.idempotency_keys
      WHERE learner_id = $1 AND idem_key = $2
      LIMIT 1`,
    [learnerId, idemKey]
  );
  return row?.ticket_id ?? null;
}

/** Records the idempotency key -> ticket mapping (best-effort, ON CONFLICT no-op). */
export async function recordIdempotencyKey(
  learnerId: string,
  idemKey: string,
  ticketId: string
): Promise<void> {
  await query(
    `INSERT INTO meridian.idempotency_keys (learner_id, idem_key, ticket_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (learner_id, idem_key) DO NOTHING`,
    [learnerId, idemKey, ticketId]
  );
}

/**
 * Create a learner-owned ticket (write-scoped by learner_id). ticket_id comes
 * from learner_ticket_seq so it never collides with seeded canonical tickets.
 */
export function createLearnerTicket(opts: {
  disputeId: string;
  customerId: string;
  learnerId: string | null;
  channel: string;
  subject: string;
  body: string;
}): Promise<CreatedTicket | null> {
  return queryOne<CreatedTicket>(
    `INSERT INTO meridian.tickets
        (ticket_id, dispute_id, customer_id, channel, subject, body,
         status, is_duplicate, created_at, learner_id)
     VALUES
        (nextval('meridian.learner_ticket_seq'), $1, $2, $3, $4, $5,
         'open', false, now(), $6)
     RETURNING ticket_id, dispute_id, customer_id, channel, subject, body,
               status, is_duplicate, duplicate_of, created_at, learner_id`,
    [opts.disputeId, opts.customerId, opts.channel, opts.subject, opts.body, opts.learnerId]
  );
}

// ---------------------------------------------------------------------------
// Audit log read (the principal's OWN rows — how students SEE allow/deny)
// ---------------------------------------------------------------------------

export type AuditRow = {
  audit_id: string;
  analyst_id: string | null;
  learner_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  scope: string | null;
  decision: string;
  detail: unknown;
  ts: string;
};

export function getLearnerAudit(opts: {
  learnerId: string | null;
  analystId: number;
  limit: number;
}): Promise<AuditRow[]> {
  return query<AuditRow>(
    `SELECT audit_id, analyst_id, learner_id, action, resource_type,
            resource_id, scope, decision, detail, ts
       FROM meridian.audit_log
      WHERE learner_id = $1 OR analyst_id = $2
      ORDER BY ts DESC, audit_id DESC
      LIMIT $3`,
    [opts.learnerId, opts.analystId, opts.limit]
  );
}
