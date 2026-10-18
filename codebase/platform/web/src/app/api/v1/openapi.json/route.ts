import { NextResponse } from "next/server";

// Hand-written OpenAPI 3.1 spec for the Meridian agent-facing API. Served (no
// auth) at /api/v1/openapi.json and rendered at /api/docs.
const spec = {
  openapi: "3.1.0",
  info: {
    title: "Meridian Bank Agent API",
    version: "1.0.0",
    description:
      "Agent-facing REST API for the Meridian Bank teaching platform. " +
      "An API key maps to a seeded analyst seat (OBO simulation): the agent acts AS that analyst. " +
      "RBAC scope (type_a / type_b / all) is enforced in this deterministic API layer — never by the LLM. " +
      "Every cross-scope access is denied (403) and logged to the audit trail; allowed access is logged too.",
  },
  servers: [{ url: "/api/v1" }],
  security: [{ bearerKey: [] }],
  components: {
    securitySchemes: {
      bearerKey: {
        type: "http",
        scheme: "bearer",
        description:
          "API key as 'Authorization: Bearer <key>' (or 'X-API-Key: <key>'). " +
          "Keys look like mrdn_<32 hex> and map to a scoped analyst seat.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              hint: { type: "string" },
            },
            required: ["code", "message"],
          },
        },
      },
      Principal: {
        type: "object",
        properties: {
          analystId: { type: "integer" },
          fullName: { type: "string" },
          email: { type: "string" },
          scope: { type: "string", enum: ["type_a", "type_b", "all"] },
          role: { type: "string", enum: ["analyst", "lead", "admin"] },
          learnerId: { type: ["string", "null"] },
        },
      },
      QueueRow: {
        type: "object",
        description: "BIGINT ids are serialized as strings.",
        properties: {
          dispute_id: { type: "string" },
          dispute_type: { type: "string", enum: ["A", "B"] },
          reason_code: { type: "string" },
          status: { type: "string" },
          opened_at: { type: "string", format: "date-time" },
          reg_e_due_at: { type: "string", format: "date-time" },
          sla_breached: { type: "boolean" },
          hours_to_deadline: { type: ["number", "null"] },
          customer_name: { type: "string" },
          amount_cents: { type: "string" },
          merchant_name: { type: "string" },
          merchant_risk: { type: "string" },
          assigned_analyst: { type: ["string", "null"] },
        },
      },
      Ticket: {
        type: "object",
        properties: {
          ticket_id: { type: "string" },
          dispute_id: { type: ["string", "null"] },
          customer_id: { type: "string" },
          channel: { type: "string", enum: ["phone", "email", "branch", "chat"] },
          subject: { type: "string" },
          body: { type: "string" },
          status: { type: "string" },
          is_duplicate: { type: "boolean" },
          duplicate_of: { type: ["string", "null"] },
          created_at: { type: "string", format: "date-time" },
          learner_id: { type: ["string", "null"] },
        },
      },
      AuditRow: {
        type: "object",
        properties: {
          audit_id: { type: "string" },
          analyst_id: { type: ["string", "null"] },
          learner_id: { type: ["string", "null"] },
          action: { type: "string" },
          resource_type: { type: ["string", "null"] },
          resource_id: { type: ["string", "null"] },
          scope: { type: ["string", "null"] },
          decision: { type: "string", enum: ["allow", "deny"] },
          detail: { type: ["object", "null"] },
          ts: { type: "string", format: "date-time" },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Missing or invalid API key.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      ForbiddenScope: {
        description: "Out-of-scope access — denied and logged (code: forbidden_scope).",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
      NotFound: {
        description: "Resource not found.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        summary: "Liveness + DB reachability",
        security: [],
        responses: {
          "200": {
            description: "Service up.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    service: { type: "string" },
                    db: { type: "string", enum: ["up", "down"] },
                    time: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "503": { description: "DB down." },
        },
      },
    },
    "/me": {
      get: {
        summary: "whoami — the analyst seat the agent is acting as",
        responses: {
          "200": {
            description: "The seat.",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Principal" } } },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/disputes": {
      get: {
        summary: "List disputes (scope-enforced queue, by urgency)",
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["intake", "investigating", "provisional_credit"] },
          },
          {
            name: "type",
            in: "query",
            description: "A | B — only honored for scope all/lead/admin.",
            schema: { type: "string", enum: ["A", "B"] },
          },
          { name: "breached", in: "query", schema: { type: "boolean" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          "200": {
            description: "Scoped dispute list.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    disputes: { type: "array", items: { $ref: "#/components/schemas/QueueRow" } },
                    count: { type: "integer" },
                    scope: { type: "string" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/disputes/{id}": {
      get: {
        summary: "Get one dispute (scope-enforced)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Dispute detail." },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenScope" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/disputes/{id}/evidence": {
      get: {
        summary: "List evidence for a dispute (scope-checked via parent)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Evidence rows." },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenScope" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/disputes/{id}/tickets": {
      get: {
        summary: "List tickets for a dispute (scope-checked)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Tickets." },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenScope" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      post: {
        summary: "Create a ticket (human-handoff write). Supports Idempotency-Key.",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          {
            name: "Idempotency-Key",
            in: "header",
            required: false,
            description: "Replaying the same key returns the original ticket (Idempotent-Replay: true).",
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["channel", "subject", "body"],
                properties: {
                  channel: { type: "string", enum: ["phone", "email", "branch", "chat"] },
                  subject: { type: "string" },
                  body: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Ticket created.",
            content: {
              "application/json": {
                schema: { type: "object", properties: { ticket: { $ref: "#/components/schemas/Ticket" } } },
              },
            },
          },
          "200": { description: "Idempotent replay of an existing ticket." },
          "400": { description: "Invalid body / params." },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/ForbiddenScope" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/transactions": {
      get: {
        summary: "List transactions",
        parameters: [
          { name: "accountId", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          "200": { description: "Transactions." },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/customers/{id}": {
      get: {
        summary: "Customer 360 (profile + accounts + recent txns + scoped disputes)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Customer 360 payload." },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/policies": {
      get: {
        summary: "Search the policy KB (RAG path; never surfaces the poisoned chunk)",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
        ],
        responses: {
          "200": { description: "Matching policy chunks." },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/audit": {
      get: {
        summary: "The caller's own audit rows (allow + deny), newest first",
        parameters: [{ name: "limit", in: "query", schema: { type: "integer", default: 50, maximum: 200 } }],
        responses: {
          "200": {
            description: "Audit rows.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    audit: { type: "array", items: { $ref: "#/components/schemas/AuditRow" } },
                    count: { type: "integer" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
  },
} as const;

export async function GET() {
  return NextResponse.json(spec);
}
