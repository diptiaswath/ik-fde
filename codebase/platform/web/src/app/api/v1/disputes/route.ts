import { ok, apiError, requireAuth } from "@/lib/api/respond";
import { logAudit } from "@/lib/api/audit";
import { getQueue } from "@/lib/queries";

const OPEN_STATUSES = ["intake", "investigating", "provisional_credit"];

function clampLimit(raw: string | null, def: number, max: number): number {
  const n = raw ? Number.parseInt(raw, 10) : def;
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}

// GET /api/v1/disputes — scope-enforced queue listing.
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const p = auth.principal;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  if (status && !OPEN_STATUSES.includes(status)) {
    return apiError(
      400,
      "invalid_param",
      `Unknown status '${status}'.`,
      `Valid open statuses: ${OPEN_STATUSES.join(", ")}.`
    );
  }
  const typeParam = url.searchParams.get("type"); // only honored for all/lead/admin
  const breached = url.searchParams.get("breached") === "true";
  const limit = clampLimit(url.searchParams.get("limit"), 50, 200);
  // offset is accepted for API symmetry; getQueue orders by urgency + limits.
  const offset = clampLimit(url.searchParams.get("offset"), 0, 1_000_000);

  const rows = await getQueue({
    scope: p.scope,
    limit,
    status: status ?? undefined,
    breachedOnly: breached,
    type: typeParam ?? undefined,
  });

  await logAudit({
    analystId: p.analystId,
    learnerId: p.learnerId,
    action: "list_disputes",
    resourceType: "dispute",
    scope: p.scope,
    decision: "allow",
    detail: { status, type: typeParam, breached, limit, offset, count: rows.length },
  });

  return ok({ disputes: rows, count: rows.length, scope: p.scope });
}
