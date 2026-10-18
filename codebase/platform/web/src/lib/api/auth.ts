import { createHash } from "crypto";
import { queryOne } from "@/lib/db";

/**
 * The authenticated principal behind an API key. This is the seeded analyst
 * SEAT the agent is acting AS (OBO simulation). The scope + learnerId here are
 * what the API layer enforces on every request.
 */
export type Principal = {
  analystId: number;
  learnerId: string | null;
  scope: string; // type_a | type_b | all
  role: string; // analyst | lead | admin
  fullName: string;
  email: string;
  keyHash: string; // for rate-limiting
};

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function extractKey(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth) {
    const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
    if (m) return m[1].trim();
  }
  const apiKey = req.headers.get("x-api-key");
  if (apiKey) return apiKey.trim();
  return null;
}

/**
 * Resolve the Bearer (or X-API-Key) credential to a Principal, or null.
 * Looks up the sha256 hash in meridian.api_keys, joining analysts, requiring the
 * key is not revoked. analyst_id is cast to int (BIGINT -> JS number).
 */
export async function authenticatePrincipal(
  req: Request
): Promise<Principal | null> {
  const key = extractKey(req);
  if (!key) return null;
  const keyHash = hashKey(key);
  const row = await queryOne<{
    analyst_id: number;
    learner_id: string | null;
    scope: string;
    role: string;
    full_name: string;
    email: string;
  }>(
    `SELECT a.analyst_id::int AS analyst_id,
            COALESCE(k.learner_id, a.learner_id) AS learner_id,
            a.scope, a.role, a.full_name, a.email
       FROM meridian.api_keys k
       JOIN meridian.analysts a ON a.analyst_id = k.analyst_id
      WHERE k.key_hash = $1
        AND k.revoked = FALSE
      LIMIT 1`,
    [keyHash]
  );
  if (!row) return null;
  return {
    analystId: row.analyst_id,
    learnerId: row.learner_id,
    scope: row.scope,
    role: row.role,
    fullName: row.full_name,
    email: row.email,
    keyHash,
  };
}
