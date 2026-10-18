import { NextResponse } from "next/server";
import {
  authenticatePrincipal,
  type Principal,
} from "./auth";
import { checkRateLimit } from "./ratelimit";

/** Success envelope. Pass any JSON-serializable data. */
export function ok(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

/**
 * Structured, agent-readable error envelope: { error: { code, message, hint? } }.
 * `code` is a stable machine string; `message` is human-readable; `hint` tells an
 * agent how to recover.
 */
export function apiError(
  status: number,
  code: string,
  message: string,
  hint?: string,
  init?: ResponseInit
): NextResponse {
  const body: { error: { code: string; message: string; hint?: string } } = {
    error: { code, message },
  };
  if (hint) body.error.hint = hint;
  return NextResponse.json(body, { ...init, status });
}

export type AuthResult =
  | { ok: true; principal: Principal }
  | { ok: false; response: NextResponse };

/**
 * The shared guard for every authed handler: rate-limit, then authenticate.
 * Returns either a Principal or the NextResponse to short-circuit with.
 */
export async function requireAuth(req: Request): Promise<AuthResult> {
  const principal = await authenticatePrincipal(req);
  if (!principal) {
    return {
      ok: false,
      response: apiError(
        401,
        "unauthorized",
        "Missing or invalid API key.",
        "Send your key as 'Authorization: Bearer <key>' or 'X-API-Key: <key>'."
      ),
    };
  }
  const rl = checkRateLimit(principal.keyHash);
  if (!rl.ok) {
    return {
      ok: false,
      response: apiError(
        429,
        "rate_limited",
        "Rate limit exceeded.",
        `Retry after ${rl.retryAfter ?? 60}s.`,
        { headers: { "Retry-After": String(rl.retryAfter ?? 60) } }
      ),
    };
  }
  return { ok: true, principal };
}
