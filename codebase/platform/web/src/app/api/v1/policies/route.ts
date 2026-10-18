import { ok, requireAuth } from "@/lib/api/respond";
import { logAudit } from "@/lib/api/audit";
import { searchPolicies } from "@/lib/queries";

function clampLimit(raw: string | null, def: number, max: number): number {
  const n = raw ? Number.parseInt(raw, 10) : def;
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}

// GET /api/v1/policies — policy KB search for the agent RAG path.
// NOTE: searchPolicies filters WHERE is_poisoned = false. The W16 incident flips
// this to include the poisoned chunk in the agent retrieval path.
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const p = auth.principal;

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const limit = clampLimit(url.searchParams.get("limit"), 20, 100);

  const chunks = await searchPolicies({ q, limit });

  await logAudit({
    analystId: p.analystId,
    learnerId: p.learnerId,
    action: "search_policy",
    resourceType: "policy",
    scope: p.scope,
    decision: "allow",
    detail: { q: q ?? null, count: chunks.length },
  });

  return ok({ chunks, count: chunks.length, query: q ?? null });
}
