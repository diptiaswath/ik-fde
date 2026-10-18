import { ok, requireAuth } from "@/lib/api/respond";
import { logAudit } from "@/lib/api/audit";
import { getTransactions } from "@/lib/queries";

function clampLimit(raw: string | null, def: number, max: number): number {
  const n = raw ? Number.parseInt(raw, 10) : def;
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}

// GET /api/v1/transactions — paged transaction explorer.
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const p = auth.principal;

  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId") ?? undefined;
  const limit = clampLimit(url.searchParams.get("limit"), 50, 200);
  const offset = clampLimit(url.searchParams.get("offset"), 0, 1_000_000);

  const rows = await getTransactions({ accountId, limit, offset });

  await logAudit({
    analystId: p.analystId,
    learnerId: p.learnerId,
    action: "list_transactions",
    resourceType: "account",
    resourceId: accountId ?? null,
    scope: p.scope,
    decision: "allow",
    detail: { accountId: accountId ?? null, limit, offset, count: rows.length },
  });

  return ok({ transactions: rows, count: rows.length });
}
