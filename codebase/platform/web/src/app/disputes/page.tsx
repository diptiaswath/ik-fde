import Link from "next/link";
import { Inbox } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Panel, Empty, DbErrorPanel } from "@/components/ui";
import { getQueue, getQueueStats, type QueueRow, type QueueStats } from "@/lib/queries";
import { formatCents, formatCountdown, slaTier } from "@/lib/format";
import {
  RiskBadge,
  SlaPill,
  BreachedBadge,
  StatusBadge,
  TypeBadge,
  Avatar,
} from "@/components/badges";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = [
  { key: "", label: "All open" },
  { key: "intake", label: "Intake" },
  { key: "investigating", label: "Investigating" },
  { key: "provisional_credit", label: "Provisional credit" },
];

export default async function DisputesQueuePage({
  searchParams,
}: {
  searchParams: { status?: string; breach?: string; type?: string };
}) {
  const session = requireSession();

  const status = searchParams.status ?? "";
  const breachedOnly = searchParams.breach === "1";
  const typeParam =
    searchParams.type === "A" || searchParams.type === "B"
      ? searchParams.type
      : "";
  const scoped = session.scope === "type_a" || session.scope === "type_b";

  let rows: QueueRow[] = [];
  let stats: QueueStats = { total_open: 0, breached: 0 };
  let dbError = false;
  try {
    [rows, stats] = await Promise.all([
      getQueue({
        scope: session.scope,
        status: status || undefined,
        breachedOnly,
        type: typeParam || undefined,
      }),
      getQueueStats(session.scope),
    ]);
  } catch {
    dbError = true;
  }

  const breachPct =
    stats.total_open > 0
      ? Math.round((stats.breached / stats.total_open) * 100)
      : 0;

  const buildHref = (next: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { status, breach: breachedOnly ? "1" : "", type: typeParam, ...next };
    if (merged.status) sp.set("status", merged.status);
    if (merged.breach) sp.set("breach", merged.breach);
    if (merged.type) sp.set("type", merged.type);
    const s = sp.toString();
    return `/disputes${s ? `?${s}` : ""}`;
  };

  return (
    <AppShell session={session} title="Disputes" crumbs={[{ label: "Dispute queue" }]}>
      <div className="mb-4 flex items-end justify-between">
        <p className="text-sm text-meridian-muted">
          Open disputes ordered by Reg E deadline · most urgent first
          {scoped ? (
            <span className="ml-1 text-slate-400">
              (scoped to {session.scope === "type_a" ? "Type A" : "Type B"})
            </span>
          ) : null}
        </p>
      </div>

      {/* Summary stats bar */}
      <div className="mb-4 grid grid-cols-3 gap-4">
        <SummaryStat label="Open disputes" value={stats.total_open.toLocaleString()} />
        <SummaryStat
          label="SLA breached"
          value={stats.breached.toLocaleString()}
          tone="danger"
        />
        <SummaryStat label="% breached" value={`${breachPct}%`} tone="danger" />
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-meridian-line bg-white p-1 shadow-card">
          {STATUS_FILTERS.map((f) => {
            const active = status === f.key;
            return (
              <Link
                key={f.key}
                href={buildHref({ status: f.key || undefined })}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-meridian-primary text-white shadow-sm"
                    : "text-meridian-muted hover:bg-meridian-bg"
                )}
              >
                {f.label}
              </Link>
            );
          })}
        </div>

        <Link
          href={buildHref({ breach: breachedOnly ? undefined : "1" })}
          className={cn(
            "rounded-lg border px-3 py-2 text-xs font-medium shadow-card transition-colors",
            breachedOnly
              ? "border-rose-300 bg-rose-50 text-rose-700"
              : "border-meridian-line bg-white text-meridian-muted hover:bg-meridian-bg"
          )}
        >
          Breached only
        </Link>

        {!scoped ? (
          <div className="flex items-center gap-1 rounded-lg border border-meridian-line bg-white p-1 shadow-card">
            {[
              { key: "", label: "Both" },
              { key: "A", label: "Type A" },
              { key: "B", label: "Type B" },
            ].map((t) => {
              const active = typeParam === t.key;
              return (
                <Link
                  key={t.key}
                  href={buildHref({ type: t.key || undefined })}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-meridian-darkest text-white"
                      : "text-meridian-muted hover:bg-meridian-bg"
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>

      {dbError ? (
        <DbErrorPanel />
      ) : (
        <Panel bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr className="border-b border-meridian-line">
                  <th className="bg-white px-4 py-2.5 shadow-[inset_0_-1px_0_0_#E6E9E6]">Dispute</th>
                  <th className="bg-white px-4 py-2.5 shadow-[inset_0_-1px_0_0_#E6E9E6]">Type</th>
                  <th className="bg-white px-4 py-2.5 shadow-[inset_0_-1px_0_0_#E6E9E6]">Customer</th>
                  <th className="bg-white px-4 py-2.5 shadow-[inset_0_-1px_0_0_#E6E9E6]">Merchant</th>
                  <th className="bg-white px-4 py-2.5 shadow-[inset_0_-1px_0_0_#E6E9E6] text-right">Amount</th>
                  <th className="bg-white px-4 py-2.5 shadow-[inset_0_-1px_0_0_#E6E9E6]">Status</th>
                  <th className="bg-white px-4 py-2.5 shadow-[inset_0_-1px_0_0_#E6E9E6]">Assignee</th>
                  <th className="bg-white px-4 py-2.5 shadow-[inset_0_-1px_0_0_#E6E9E6]">Reg E deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-meridian-line">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <Empty icon={<Inbox className="h-7 w-7" />}>
                        No open disputes match these filters.
                      </Empty>
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const h =
                      r.hours_to_deadline === null
                        ? null
                        : Number(r.hours_to_deadline);
                    const tier = slaTier(h, r.sla_breached);
                    return (
                      <tr
                        key={r.dispute_id}
                        className="group transition-colors hover:bg-meridian-bg/60"
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/disputes/${r.dispute_id}`}
                            className="font-mono text-sm font-medium text-meridian-deep group-hover:underline"
                          >
                            #{r.dispute_id}
                          </Link>
                          <div className="text-xs text-slate-400">
                            {r.reason_code}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <TypeBadge type={r.dispute_type} />
                        </td>
                        <td className="px-4 py-2.5 text-meridian-ink">
                          {r.customer_name}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-meridian-ink">
                              {r.merchant_name}
                            </span>
                            <RiskBadge risk={r.merchant_risk} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-medium tnum text-meridian-ink">
                          {formatCents(r.amount_cents)}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Avatar name={r.assigned_analyst} size="xs" />
                            <span className="text-xs text-slate-500">
                              {r.assigned_analyst ?? "Unassigned"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <SlaPill tier={tier} label={formatCountdown(h)} />
                            {r.sla_breached ? <BreachedBadge /> : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      <p className="mt-3 text-xs text-slate-400">
        Showing up to 200 most-urgent open disputes.
      </p>
    </AppShell>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger";
}) {
  return (
    <div className="rounded-lg border border-meridian-line bg-white p-4 shadow-card">
      <div className="text-xs font-medium text-meridian-muted">{label}</div>
      <div
        className={cn(
          "mt-1 font-mono text-2xl font-semibold tnum",
          tone === "danger" ? "text-rose-600" : "text-meridian-ink"
        )}
      >
        {value}
      </div>
    </div>
  );
}
