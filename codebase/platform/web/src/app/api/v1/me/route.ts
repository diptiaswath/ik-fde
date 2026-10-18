import { ok, requireAuth } from "@/lib/api/respond";
import { logAudit } from "@/lib/api/audit";

// whoami — returns the seat the agent is acting as.
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const p = auth.principal;

  await logAudit({
    analystId: p.analystId,
    learnerId: p.learnerId,
    action: "whoami",
    resourceType: "analyst",
    resourceId: String(p.analystId),
    scope: p.scope,
    decision: "allow",
  });

  return ok({
    analystId: p.analystId,
    fullName: p.fullName,
    email: p.email,
    scope: p.scope,
    role: p.role,
    learnerId: p.learnerId,
  });
}
