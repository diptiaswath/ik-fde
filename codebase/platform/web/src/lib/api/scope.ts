// Scope enforcement for the agent-facing API. The teaching point of the whole
// platform: RBAC is decided HERE, in the deterministic API layer — never by the
// LLM. A type_a seat sees only Type-A disputes; type_b only Type-B; all/lead/
// admin see everything.

import { scopeToType, getDisputeTypeById } from "@/lib/queries";
import { apiError } from "./respond";
import { logAudit } from "./audit";
import type { Principal } from "./auth";

export { scopeToType };

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

import type { NextResponse } from "next/server";

export type ScopeGuard =
  | { allowed: true; disputeType: string; customerId: string }
  | { allowed: false; response: NextResponse };

/**
 * Shared scope gate for any sub-resource hung off a dispute (evidence, tickets).
 * Looks up the parent dispute's type, applies disputeDecision, writes the deny
 * audit row + returns 403 on deny, or returns the dispute meta on allow.
 * 404 if the dispute doesn't exist. `action` is the audit action to log on deny.
 */
export async function guardDisputeAccess(
  p: Principal,
  disputeId: string,
  action: string
): Promise<ScopeGuard> {
  const meta = await getDisputeTypeById(disputeId);
  if (!meta) {
    return {
      allowed: false,
      response: apiError(404, "not_found", `Dispute ${disputeId} not found.`),
    };
  }
  const decision = disputeDecision(p.scope, meta.dispute_type);
  if (decision === "deny") {
    await logAudit({
      analystId: p.analystId,
      learnerId: p.learnerId,
      action,
      resourceType: "dispute",
      resourceId: disputeId,
      scope: p.scope,
      decision: "deny",
      detail: { dispute_type: meta.dispute_type, reason: "out_of_scope" },
    });
    return {
      allowed: false,
      response: apiError(
        403,
        "forbidden_scope",
        `Your seat (scope='${p.scope}') is not permitted to access Type-${meta.dispute_type} disputes.`,
        "This access was denied and logged in the audit trail. Only the correctly-scoped seat may read this dispute."
      ),
    };
  }
  return {
    allowed: true,
    disputeType: meta.dispute_type,
    customerId: meta.customer_id,
  };
}
