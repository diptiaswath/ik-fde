import { query } from "@/lib/db";

/**
 * Append one row to meridian.audit_log. EVERY agent tool call writes here —
 * allow AND deny — which is the W16 RBAC-made-visible surface. Awaited but never
 * fatal: an audit failure must not crash the underlying request.
 */
export async function logAudit(entry: {
  analystId: number | null;
  learnerId: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  scope?: string | null;
  decision: "allow" | "deny";
  detail?: unknown;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO meridian.audit_log
          (analyst_id, learner_id, action, resource_type, resource_id,
           scope, decision, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        entry.analystId,
        entry.learnerId,
        entry.action,
        entry.resourceType ?? null,
        entry.resourceId ?? null,
        entry.scope ?? null,
        entry.decision,
        entry.detail != null ? JSON.stringify(entry.detail) : null,
      ]
    );
  } catch (err) {
    // Audit must never break the request. Log and move on.
    console.error("[audit] failed to write audit row:", err);
  }
}
