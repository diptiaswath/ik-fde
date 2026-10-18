import { ok, apiError, requireAuth } from "@/lib/api/respond";
import { logAudit } from "@/lib/api/audit";
import { disputeDecision } from "@/lib/api/scope";
import { getDispute, getDisputeTypeById } from "@/lib/queries";

// GET /api/v1/disputes/:id — scope-enforced single dispute read.
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const p = auth.principal;
  const id = params.id;

  const meta = await getDisputeTypeById(id);
  if (!meta) {
    return apiError(404, "not_found", `Dispute ${id} not found.`);
  }

  const decision = disputeDecision(p.scope, meta.dispute_type);
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
      "This access was denied and logged in the audit trail. Only the correctly-scoped seat may read this dispute."
    );
  }

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
