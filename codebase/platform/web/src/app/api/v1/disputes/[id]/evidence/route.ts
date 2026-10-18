import { ok, requireAuth } from "@/lib/api/respond";
import { logAudit } from "@/lib/api/audit";
import { guardDisputeAccess } from "@/lib/api/scope";
import { getEvidence } from "@/lib/queries";

// GET /api/v1/disputes/:id/evidence — scope-checked via the parent dispute.
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const p = auth.principal;
  const id = params.id;

  const guard = await guardDisputeAccess(p, id, "fetch_evidence");
  if (!guard.allowed) return guard.response;

  const evidence = await getEvidence(id);
  await logAudit({
    analystId: p.analystId,
    learnerId: p.learnerId,
    action: "fetch_evidence",
    resourceType: "dispute",
    resourceId: id,
    scope: p.scope,
    decision: "allow",
    detail: { count: evidence.length },
  });

  return ok({ dispute_id: id, evidence, count: evidence.length });
}
