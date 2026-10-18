# Meridian Bank — Agent-Facing API

The deterministic REST surface every student's agent integrates against. It sits
in front of the Meridian Postgres data tier and is where the platform teaches the
things a raw auto-API won't: **OBO-simulated identity, RBAC enforced in the API
layer (never the LLM), an audit trail, idempotent writes, rate limits, and
structured agent-readable errors.**

Base path: `/api/v1` · Interactive reference: **`/api/docs`** (Redoc) · Raw spec:
**`/api/v1/openapi.json`** (OpenAPI 3.1).

---

## Auth — API keys (OBO simulation)

Every authed request carries an API key:

```
Authorization: Bearer mrdn_<32 hex>
```

(`X-API-Key: mrdn_…` is also accepted.)

A key maps to a **seeded analyst seat**. The agent acts *as* that analyst —
on-behalf-of (OBO) simulation. The seat carries:

- `scope` — `type_a` | `type_b` | `all`
- `learner_id` — the student identity that owns the agent's *writes*
- `role` — `analyst` | `lead` | `admin`

Only `sha256(key)` is stored (`meridian.api_keys`); the plaintext is shown once
at mint time and is never recoverable.

### Minting keys

Apply the migration once (after `schema.sql`):

```bash
docker exec -i meridian-db psql -U meridian -d meridian < platform/db/api.sql
```

Then mint:

```bash
# A Type-A + a Type-B demo pair (the two-analyst test):
node platform/db/mint-key.mjs --demo

# A key for a specific seeded analyst:
node platform/db/mint-key.mjs --email jason.soto@meridianbank.com --label "agent dev"

# Override the learner_id the key's writes are attributed to:
node platform/db/mint-key.mjs --email jason.soto@meridianbank.com --learner learner-042
```

The script resolves `pg` from `platform/web/node_modules` and reads
`MERIDIAN_DB_URL` (defaults to the local Docker URL).

---

## RBAC & the two-analyst test (W16)

**Scope is enforced in this API layer, on every request — never by the LLM.**

- A `type_a` seat can read only Type-A disputes; `type_b` only Type-B;
  `all`/lead/admin see everything.
- Every cross-scope access is **denied (HTTP 403, `code: forbidden_scope`)** and
  written to `meridian.audit_log` with `decision='deny'`.
- Allowed accesses are written with `decision='allow'`.

The "two-analyst proof": a Type-A key and a Type-B key asking for the *same*
dispute id get correctly different answers, with matching audit rows.

```bash
A=mrdn_<type_a key>; B=mrdn_<type_b key>

# Dispute 1 is Type-B. Type-A key -> 403 forbidden_scope (and a deny audit row):
curl -s -H "Authorization: Bearer $A" localhost:3000/api/v1/disputes/1
# Same id, Type-B key -> 200 (and an allow audit row):
curl -s -H "Authorization: Bearer $B" localhost:3000/api/v1/disputes/1

# See your own allow/deny decisions:
curl -s -H "Authorization: Bearer $A" localhost:3000/api/v1/audit
```

---

## Conventions

- **IDs are strings.** BIGINT columns serialize as JSON strings (node-postgres
  default) — keep them as strings client-side.
- **Errors** use a stable envelope: `{ "error": { "code", "message", "hint"? } }`.
- **Rate limit:** 120 req/min per key (fixed window). Over-limit → `429` with a
  `Retry-After` header. Soft/per-instance on Vercel serverless.
- **Pagination:** `limit` (capped per endpoint) + `offset`.

---

## Endpoints

All examples assume `KEY=mrdn_…` and host `localhost:3000`.

### `GET /api/v1/health` — no auth
Liveness + DB reachability. `200` if DB up, `503` if down.
```bash
curl -s localhost:3000/api/v1/health
# {"status":"ok","service":"meridian-api","db":"up","time":"…"}
```

### `GET /api/v1/me`
whoami — the seat the agent is acting as.
```bash
curl -s -H "Authorization: Bearer $KEY" localhost:3000/api/v1/me
# {"analystId":1,"fullName":"Jason Soto","email":"…","scope":"type_a","role":"analyst","learnerId":"learner-001"}
```

### `GET /api/v1/disputes`
Scope-enforced queue, ordered by urgency.
Query: `status` (intake|investigating|provisional_credit), `type` (A|B — only
honored for all/lead/admin), `breached` (true), `limit` (def 50, max 200),
`offset`.
```bash
curl -s -H "Authorization: Bearer $KEY" "localhost:3000/api/v1/disputes?limit=3&breached=true"
```

### `GET /api/v1/disputes/{id}`
Single dispute, scope-checked. `403 forbidden_scope` if out of scope; `404` if
not found.
```bash
curl -s -H "Authorization: Bearer $KEY" localhost:3000/api/v1/disputes/1
```

### `GET /api/v1/disputes/{id}/evidence`
Evidence for a dispute (scope-checked via the parent).
```bash
curl -s -H "Authorization: Bearer $KEY" localhost:3000/api/v1/disputes/1/evidence
```

### `GET /api/v1/disputes/{id}/tickets`
List tickets for a dispute (scope-checked).

### `POST /api/v1/disputes/{id}/tickets` — the human-handoff write
Body: `{ "channel": "phone|email|branch|chat", "subject": "...", "body": "..." }`.
Scope-checked first. The created ticket carries the caller's `learner_id`
(write-scoping) and an id from `learner_ticket_seq`.

**Idempotency:** send an `Idempotency-Key` header. A replay (same `learner_id` +
key) returns the original ticket with `200` + `Idempotent-Replay: true`; the first
call returns `201`.
```bash
curl -s -X POST -H "Authorization: Bearer $KEY" \
  -H "Idempotency-Key: handoff-001" -H "Content-Type: application/json" \
  -d '{"channel":"email","subject":"Escalation","body":"Handing off to a human."}' \
  localhost:3000/api/v1/disputes/1/tickets
```

### `GET /api/v1/transactions`
Query: `accountId`, `limit` (def 50, max 200), `offset`.
```bash
curl -s -H "Authorization: Bearer $KEY" "localhost:3000/api/v1/transactions?accountId=9&limit=10"
```

### `GET /api/v1/customers/{id}`
Customer 360: `{ customer, accounts, recent_transactions, disputes }`. Disputes
are **scope-filtered** for the caller's seat (a Type-A seat won't see Type-B
disputes even here).
```bash
curl -s -H "Authorization: Bearer $KEY" localhost:3000/api/v1/customers/4556
```

### `GET /api/v1/policies`
Policy-KB search for the RAG path. Query: `q`, `limit` (def 20, max 100).
Never surfaces the poisoned chunk (`is_poisoned = false`). *(The W16 incident
hook flips this to include the poisoned chunk in the agent retrieval path.)*
```bash
curl -s -H "Authorization: Bearer $KEY" "localhost:3000/api/v1/policies?q=provisional%20credit"
```

### `GET /api/v1/audit`
The caller's **own** audit rows (allow + deny), newest first. Query: `limit`
(def 50, max 200). This read is itself **not** audited (avoids recursion). This is
how students see their agent's RBAC decisions.
```bash
curl -s -H "Authorization: Bearer $KEY" localhost:3000/api/v1/audit
```

---

## Deploy to Vercel + Supabase

> The actual deploy needs your Supabase + Vercel credentials. These are the steps;
> nothing here was run for you.

1. **Create a Supabase project.** Grab the **session-mode pooler** connection
   string (Project → Settings → Database → Connection string → *Session pooler*).

2. **Apply the schema, then the API migration, then seed** to the Supabase DB:
   ```bash
   psql "<SUPABASE_POOLER_URL>" -f platform/db/schema.sql
   psql "<SUPABASE_POOLER_URL>" -f platform/db/api.sql
   # then run the seed generator / load (see platform/db seed assets)
   ```

3. **Deploy the web app to Vercel** from `platform/web`:
   ```bash
   cd platform/web
   vercel            # first run links/creates the project
   vercel --prod
   ```

4. **Set the env var** in Vercel (Project → Settings → Environment Variables):
   ```
   MERIDIAN_DB_URL = <SUPABASE_POOLER_URL>
   ```
   SSL is auto-enabled for non-localhost hosts (`src/lib/db.ts`), so the Supabase
   connection is encrypted with no extra config.

5. **Mint hosted keys** by pointing the script at the hosted DB:
   ```bash
   MERIDIAN_DB_URL="<SUPABASE_POOLER_URL>" node platform/db/mint-key.mjs --demo
   ```

6. Redeploy after any env change, then verify `https://<app>.vercel.app/api/v1/health`.
