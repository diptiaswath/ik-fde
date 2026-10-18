import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

// Run the DB check on every request (don't cache the liveness result).
export const dynamic = "force-dynamic";

// No auth. Liveness + DB reachability for the agent and for monitoring.
export async function GET() {
  const time = new Date().toISOString();
  let db: "up" | "down" = "down";
  try {
    const row = await queryOne<{ ok: number }>("SELECT 1 AS ok");
    db = row?.ok === 1 ? "up" : "down";
  } catch {
    db = "down";
  }
  return NextResponse.json(
    { status: "ok", service: "meridian-api", db, time },
    { status: db === "up" ? 200 : 503 }
  );
}
