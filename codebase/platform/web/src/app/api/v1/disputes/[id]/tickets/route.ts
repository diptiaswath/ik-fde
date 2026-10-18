import { ok, apiError, requireAuth } from "@/lib/api/respond";
import { logAudit } from "@/lib/api/audit";
import { guardDisputeAccess } from "@/lib/api/scope";
import {
  getDisputeTickets,
  createLearnerTicket,
  getTicketById,
  findIdempotentTicket,
  recordIdempotencyKey,
} from "@/lib/queries";

const VALID_CHANNELS = ["phone", "email", "branch", "chat"];

// GET /api/v1/disputes/:id/tickets — list tickets for a dispute (scope-checked).
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const p = auth.principal;
  const id = params.id;

  const guard = await guardDisputeAccess(p, id, "list_tickets");
  if (!guard.allowed) return guard.response;

  const tickets = await getDisputeTickets(id);
  await logAudit({
    analystId: p.analystId,
    learnerId: p.learnerId,
    action: "list_tickets",
    resourceType: "dispute",
    resourceId: id,
    scope: p.scope,
    decision: "allow",
    detail: { count: tickets.length },
  });

  return ok({ dispute_id: id, tickets, count: tickets.length });
}

// POST /api/v1/disputes/:id/tickets — the human-handoff WRITE action.
// Scope-checked first; supports the Idempotency-Key header.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const p = auth.principal;
  const id = params.id;

  const guard = await guardDisputeAccess(p, id, "create_ticket");
  if (!guard.allowed) return guard.response;

  let body: { channel?: unknown; subject?: unknown; body?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiError(
      400,
      "invalid_body",
      "Request body must be valid JSON.",
      "Send { channel, subject, body }."
    );
  }

  const channel = typeof body.channel === "string" ? body.channel.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";

  if (!channel || !subject || !text) {
    return apiError(
      400,
      "invalid_body",
      "Missing required fields.",
      "Provide non-empty 'channel', 'subject', and 'body'."
    );
  }
  if (!VALID_CHANNELS.includes(channel)) {
    return apiError(
      400,
      "invalid_param",
      `Unknown channel '${channel}'.`,
      `Valid channels: ${VALID_CHANNELS.join(", ")}.`
    );
  }

  // Idempotency: scoped to (learner_id, idem_key). A replay returns the original.
  const idemKey = req.headers.get("idempotency-key")?.trim() || null;
  if (idemKey && p.learnerId) {
    const existingId = await findIdempotentTicket(p.learnerId, idemKey);
    if (existingId) {
      const existing = await getTicketById(existingId);
      await logAudit({
        analystId: p.analystId,
        learnerId: p.learnerId,
        action: "create_ticket",
        resourceType: "ticket",
        resourceId: existingId,
        scope: p.scope,
        decision: "allow",
        detail: { idempotent_replay: true, dispute_id: id },
      });
      return ok(
        { ticket: existing, idempotent_replay: true },
        { status: 200, headers: { "Idempotent-Replay": "true" } }
      );
    }
  }

  const ticket = await createLearnerTicket({
    disputeId: id,
    customerId: guard.customerId,
    learnerId: p.learnerId,
    channel,
    subject,
    body: text,
  });

  if (!ticket) {
    return apiError(500, "internal_error", "Failed to create ticket.");
  }

  if (idemKey && p.learnerId) {
    await recordIdempotencyKey(p.learnerId, idemKey, ticket.ticket_id);
  }

  await logAudit({
    analystId: p.analystId,
    learnerId: p.learnerId,
    action: "create_ticket",
    resourceType: "ticket",
    resourceId: ticket.ticket_id,
    scope: p.scope,
    decision: "allow",
    detail: { dispute_id: id, channel },
  });

  return ok({ ticket }, { status: 201 });
}
