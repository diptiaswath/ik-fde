import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "./LoginForm";
import { getSession } from "@/lib/session";
import { sampleAnalysts, type Analyst } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (getSession()) {
    redirect("/");
  }

  let samples: Analyst[] = [];
  let dbError = false;
  try {
    samples = await sampleAnalysts(3);
  } catch {
    dbError = true;
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-meridian-darkest p-12 text-teal-50 lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-meridian-gold font-serif text-lg font-bold text-[#0B2E2A]">
            M
          </span>
          <div className="font-serif text-xl font-semibold tracking-tight text-white">
            Meridian Bank
          </div>
        </div>
        <div>
          <h2 className="font-serif text-3xl font-semibold leading-tight text-white">
            Dispute operations,
            <br />
            under control.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-teal-100/70">
            Track Reg E deadlines, triage breached cases, gather evidence across
            source systems, and resolve disputes — all scoped to your desk.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-teal-300/60">
          <ShieldCheck className="h-4 w-4" />
          Internal use only · access is RBAC-scoped &amp; audited
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-meridian-bg px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-meridian-gold font-serif text-base font-bold text-[#0B2E2A]">
                M
              </span>
              <span className="font-serif text-lg font-semibold text-meridian-ink">
                Meridian Bank
              </span>
            </div>
          </div>

          <h1 className="text-lg font-semibold text-meridian-ink">
            Sign in to the Ops Console
          </h1>
          <p className="mb-6 mt-1 text-sm text-meridian-muted">
            Use your analyst email — no password required in this sandbox.
          </p>

          <div className="rounded-xl border border-meridian-line bg-white p-6 shadow-card">
            <LoginForm defaultEmail={samples[0]?.email} />
          </div>

          <div className="mt-4 rounded-lg border border-meridian-line bg-white/70 p-4 text-xs text-meridian-muted">
            <div className="mb-2 font-semibold text-meridian-ink">
              Sample seeded logins
            </div>
            {dbError ? (
              <p className="text-rose-600">
                Database unreachable — start Postgres and reload.
              </p>
            ) : samples.length === 0 ? (
              <p>No analysts seeded yet. Run the db load script.</p>
            ) : (
              <ul className="space-y-1">
                {samples.map((a) => (
                  <li key={a.analyst_id} className="flex justify-between gap-3">
                    <span className="font-mono text-meridian-ink">{a.email}</span>
                    <span className="text-slate-400">
                      {a.scope === "type_a"
                        ? "Type A"
                        : a.scope === "type_b"
                          ? "Type B"
                          : "All"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
