import { Pool, type QueryResultRow } from "pg";

// A single shared pool per server process. In dev, Next.js hot-reload can
// re-evaluate modules, so we stash the pool on globalThis to avoid leaking
// connections.
const globalForPg = globalThis as unknown as { __meridianPool?: Pool };

const connectionString =
  process.env.MERIDIAN_DB_URL ||
  "postgresql://meridian:meridian@localhost:5432/meridian";

export function getPool(): Pool {
  if (!globalForPg.__meridianPool) {
    globalForPg.__meridianPool = new Pool({
      connectionString,
      max: 8,
      // Fail fast if the DB is unreachable rather than hanging a request.
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      // Local dev (docker) speaks plaintext; hosted (Supabase) requires SSL.
      // Detect by host: localhost stays plaintext, everything else gets SSL.
      ssl: connectionString.includes("localhost")
        ? undefined
        : { rejectUnauthorized: false },
    });
  }
  return globalForPg.__meridianPool;
}

/**
 * Parameterized query helper. Always pass values via `params` ($1, $2, …) —
 * never interpolate user input into the SQL string.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = []
): Promise<T[]> {
  const pool = getPool();
  const res = await pool.query<T>(text, params as unknown[]);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
