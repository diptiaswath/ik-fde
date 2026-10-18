import { ok, requireAuth } from "@/lib/api/respond";
import { getLearnerAudit } from "@/lib/queries";

function clampLimit(raw: string | null, def: number, max: number): number {
  const n = raw ? Number.parseInt(raw, 10) : def;
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}

// GET /api/v1/audit — the principal's OWN audit rows (allow + deny), newest first.
// This is how students SEE their agent's RBAC decisions. We do NOT audit this
// read (it would recurse / spam the log).
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const p = auth.principal;

  const url = new URL(req.url);
  const limit = clampLimit(url.searchParams.get("limit"), 50, 200);

  const rows = await getLearnerAudit({
    learnerId: p.learnerId,
    analystId: p.analystId,
    limit,
  });

  return ok({ audit: rows, count: rows.length });
}
