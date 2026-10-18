# MERIDIAN_API_KEY Security Control

This document explains how the `MERIDIAN_API_KEY` implements Role-Based Access Control (RBAC) in the Meridian platform.

## Overview

`MERIDIAN_API_KEY` is an **analyst authentication key** that enforces scope-based access control. The key embeds the identity and permissions of a specific analyst seat, and these permissions are enforced **server-side** in the API layer—never by the LLM.

### Your Keys

From the output of `make keys`:

```
scope=type_a
  analyst : Jason Soto <jason.soto@meridianbank.com> (id 1)
  learner : learner-001
  KEY     : mrdn_afdf368f629706c3689bbef3fd242b4a

scope=type_b
  analyst : Robert Joyce <robert.joyce@meridianbank.com> (id 2)
  learner : learner-002
  KEY     : mrdn_da6b5bcb999209405fb0acb590cf687d
```

- **Type A key** → can only access fraud-type disputes (like dispute #29)
- **Type B key** → can only access merchant-type disputes (like disputes #1, #7)

## Architecture

The security control is implemented across four layers:

### 1. Database Schema

**`analysts` table** (`platform/db/schema.sql:156-166`):

```sql
CREATE TABLE analysts (
    analyst_id     BIGINT PRIMARY KEY,
    full_name      TEXT NOT NULL,
    email          TEXT NOT NULL UNIQUE,
    -- scope: drives RLS. type_a / type_b analysts see only their dispute type.
    scope          TEXT NOT NULL DEFAULT 'all',     -- type_a | type_b | all
    role           TEXT NOT NULL DEFAULT 'analyst',  -- analyst | lead | admin
    is_learner_seat BOOLEAN NOT NULL DEFAULT FALSE,
    learner_id     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**`api_keys` table** (`platform/db/api.sql:16-24`):

```sql
CREATE TABLE IF NOT EXISTS api_keys (
    key_id      BIGSERIAL PRIMARY KEY,
    key_hash    TEXT UNIQUE NOT NULL,              -- SHA-256 of the actual key
    analyst_id  BIGINT REFERENCES analysts(analyst_id),
    learner_id  TEXT,
    label       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked     BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
```

**Security properties:**
- Keys are stored as SHA-256 hashes, never plaintext
- Each key references an analyst with a specific `scope`
- Keys can be revoked without deleting the analyst

### 2. Authentication Layer

**File:** `platform/web/src/lib/api/auth.ts`

When a request arrives with an API key:

```typescript
export async function authenticatePrincipal(req: Request): Promise<Principal | null> {
  // 1. Extract key from Authorization: Bearer <key> or X-API-Key: <key>
  const key = extractKey(req);
  if (!key) return null;

  // 2. Hash the key with SHA-256
  const keyHash = hashKey(key);

  // 3. Look up in database
  const row = await queryOne<{...}>(
    `SELECT a.analyst_id::int AS analyst_id,
            COALESCE(k.learner_id, a.learner_id) AS learner_id,
            a.scope, a.role, a.full_name, a.email
       FROM meridian.api_keys k
       JOIN meridian.analysts a ON a.analyst_id = k.analyst_id
      WHERE k.key_hash = $1
        AND k.revoked = FALSE
      LIMIT 1`,
    [keyHash]
  );

  // 4. Return Principal with scope information
  return {
    analystId: row.analyst_id,
    learnerId: row.learner_id,
    scope: row.scope,        // type_a | type_b | all
    role: row.role,
    fullName: row.full_name,
    email: row.email,
    keyHash,
  };
}
```

**Result:** A `Principal` object containing the analyst's identity and permissions.

### 3. Scope Enforcement Layer

**File:** `platform/web/src/lib/api/scope.ts`

The authorization decision logic:

```typescript
/**
 * The allow/deny decision for a scoped seat reading a dispute of a given type.
 * - type_a may read Type-A only
 * - type_b may read Type-B only
 * - all / lead / admin (scopeToType === null) may read anything
 */
export function disputeDecision(
  scope: string,
  disputeType: string
): "allow" | "deny" {
  const allowedType = scopeToType(scope);
  if (allowedType === null) return "allow"; // all / lead / admin
  return allowedType === disputeType ? "allow" : "deny";
}
```

**Rules:**
- `type_a` scope → can ONLY access Type-A disputes
- `type_b` scope → can ONLY access Type-B disputes
- `all`, `lead`, or `admin` scope → can access everything

From the file's header comment (line 1-4):

> "The teaching point of the whole platform: **RBAC is decided HERE, in the deterministic API layer — never by the LLM.** A type_a seat sees only Type-A disputes; type_b only Type-B; all/lead/admin see everything."

### 4. API Endpoint Enforcement

**File:** `platform/web/src/app/api/v1/disputes/[id]/route.ts`

Every API endpoint applies the scope check:

```typescript
export async function GET(req: Request, { params }: { params: { id: string } }) {
  // 1. Authenticate: extract and validate the API key
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const p = auth.principal;  // Principal with scope information

  // 2. Look up the dispute's type
  const meta = await getDisputeTypeById(id);
  if (!meta) {
    return apiError(404, "not_found", `Dispute ${id} not found.`);
  }

  // 3. Apply the scope decision
  const decision = disputeDecision(p.scope, meta.dispute_type);

  // 4. On deny: log to audit trail and return 403
  if (decision === "deny") {
    await logAudit({
      analystId: p.analystId,
      learnerId: p.learnerId,
      action: "lookup_dispute",
      resourceType: "dispute",
      resourceId: id,
      scope: p.scope,
      decision: "deny",
      detail: { dispute_type: meta.dispute_type, reason: "out_of_scope" },
    });
    return apiError(
      403,
      "forbidden_scope",
      `Your seat (scope='${p.scope}') is not permitted to access Type-${meta.dispute_type} disputes.`,
      "This access was denied and logged in the audit trail."
    );
  }

  // 5. On allow: fetch the data, log the access, and return
  const dispute = await getDispute(id);
  await logAudit({
    analystId: p.analystId,
    learnerId: p.learnerId,
    action: "lookup_dispute",
    resourceType: "dispute",
    resourceId: id,
    scope: p.scope,
    decision: "allow",
    detail: { dispute_type: meta.dispute_type },
  });

  return ok({ dispute });
}
```

## Security Properties

### 1. Server-Side Enforcement

The scope is **never controlled by the client or the LLM**:
- The API key is hashed and looked up in the database
- The analyst's scope comes from the `analysts` table
- The authorization decision happens in TypeScript code on the server

**An AI agent cannot bypass this** because:
- It only has the API key as a credential
- The scope is tied to the key in the database
- Every API request validates scope server-side before returning data

### 2. Complete Audit Trail

Every access attempt (allow or deny) is logged:

```typescript
await logAudit({
  analystId: p.analystId,
  learnerId: p.learnerId,
  action: "lookup_dispute",
  resourceType: "dispute",
  resourceId: id,
  scope: p.scope,
  decision: "allow" | "deny",
  detail: { dispute_type: meta.dispute_type, reason: "out_of_scope" },
});
```

This creates an immutable audit trail of who accessed what, when, and whether it was allowed.

### 3. Defense in Depth

From `scope.ts:40-79`, the same pattern applies to all sub-resources:

```typescript
/**
 * Shared scope gate for any sub-resource hung off a dispute (evidence, tickets).
 * Looks up the parent dispute's type, applies disputeDecision, writes the deny
 * audit row + returns 403 on deny, or returns the dispute meta on allow.
 */
export async function guardDisputeAccess(
  p: Principal,
  disputeId: string,
  action: string
): Promise<ScopeGuard>
```

This means:
- `/api/v1/disputes/:id` checks scope
- `/api/v1/disputes/:id/evidence` checks scope
- `/api/v1/disputes/:id/tickets` checks scope
- Every endpoint that touches dispute data enforces the same control

## How This Maps to Your Keys

### Using the Type A Key

```bash
# In .env:
MERIDIAN_API_KEY=mrdn_afdf368f629706c3689bbef3fd242b4a

# The agent can access:
curl -H "Authorization: Bearer mrdn_afdf368f629706c3689bbef3fd242b4a" \
  http://localhost:3100/api/v1/disputes/29
# ✓ 200 OK (dispute 29 is Type-A: fraud)

curl -H "Authorization: Bearer mrdn_afdf368f629706c3689bbef3fd242b4a" \
  http://localhost:3100/api/v1/disputes/1
# ✗ 403 Forbidden (dispute 1 is Type-B: merchant, out of scope)
```

### Using the Type B Key

```bash
# In .env:
MERIDIAN_API_KEY=mrdn_da6b5bcb999209405fb0acb590cf687d

# The agent can access:
curl -H "Authorization: Bearer mrdn_da6b5bcb999209405fb0acb590cf687d" \
  http://localhost:3100/api/v1/disputes/1
# ✓ 200 OK (dispute 1 is Type-B: merchant)

curl -H "Authorization: Bearer mrdn_da6b5bcb999209405fb0acb590cf687d" \
  http://localhost:3100/api/v1/disputes/29
# ✗ 403 Forbidden (dispute 29 is Type-A: fraud, out of scope)
```

## Teaching Point (W16)

This security model is demonstrated in **Week 16: Integration, MCP, RBAC**. The key lesson:

> "A key IS an analyst seat: it carries that analyst's scope (type_a / type_b) and learner_id. **Scope is enforced server-side; the model can never widen it.**"

This is the foundation for "on-behalf-of" (OBO) execution: the agent acts **as** the analyst, with exactly the analyst's permissions—no more, no less.

## References

- **Authentication:** `platform/web/src/lib/api/auth.ts`
- **Scope Enforcement:** `platform/web/src/lib/api/scope.ts`
- **Example Endpoint:** `platform/web/src/app/api/v1/disputes/[id]/route.ts`
- **Database Schema:** `platform/db/schema.sql`, `platform/db/api.sql`
- **W16 Instructor Guide:** `curriculum/W16_Integration_MCP_RBAC/live-class/W16_Instructor_Guide.md`
