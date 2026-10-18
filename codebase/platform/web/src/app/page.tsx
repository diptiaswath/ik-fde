import Link from "next/link";
import {
  Gavel,
  AlarmClock,
  Banknote,
  Timer,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Activity,
  ShieldAlert,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Panel, Empty, DbErrorPanel } from "@/components/ui";
import { KpiCard } from "@/components/KpiCard";
import {
  OpenedPerDayChart,
  TypeDonut,
  StatusBars,
  MerchantBars,
} from "@/components/DashboardCharts";
import {
  RiskBadge,
  SlaPill,
  BreachedBadge,
  TypeBadge,
  StatusBadge,
  Avatar,
} from "@/components/badges";
import {
  getDashboardKpis,
  getDisputesOpenedPerDay,
  getDisputesByType,
  getDisputesByStatus,
  getTopMerchantsByDisputes,
  getRiskExposure,
  getNeedsAttention,
  getRecentActivity,
} from "@/lib/queries";
import {
  formatCents,
  formatCentsCompact,
  formatCountdown,
  relativeTime,
  slaTier,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = requireSession();

  let dbError = false;
  let data;
  try {
    const [
      kpis,
      perDay,
      byType,
      byStatus,
      topMerchants,
      riskExposure,
      attention,
      activity,
    ] = await Promise.all([
      getDashboardKpis(session.scope),
      getDisputesOpenedPerDay(session.scope),
      getDisputesByType(session.scope),
      getDisputesByStatus(session.scope),
      getTopMerchantsByDisputes(session.scope),
      getRiskExposure(session.scope),
      getNeedsAttention(session.scope),
      getRecentActivity(session.scope),
    ]);
    data = {
      kpis,
      perDay,
      byType,
      byStatus,
      topMerchants,
      riskExposure,
      attention,
      activity,
    };
  } catch {
    dbError = true;
  }

  const scopeNote =
    session.scope === "type_a"
      ? "Type A · card fraud"
      : session.scope === "type_b"
        ? "Type B · merchant quality"
        : "All dispute types";

  return (
    <AppShell session={session} title="Dashboard">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-sm text-meridian-muted">
            Welcome back, {session.fullName.split(" ")[0]}. Here is today&apos;s
            dispute-operations picture.
          </p>
        </div>
        <span className="hidden rounded-full border border-meridian-line bg-white px-3 py-1 text-xs font-medium text-meridian-deep shadow-card sm:inline-block">
          {scopeNote}
        </span>
      </div>

      {dbError || !data ? (
        <DbErrorPanel />
      ) : (
        <>
          {/* KPI row */}
          <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              label="Open disputes"
              value={data.kpis.total_open.toLocaleString()}
              icon={Gavel}
              sub="in your queue"
            />
            <KpiCard
              label="SLA breached"
              value={data.kpis.breached.toLocaleString()}
              icon={AlarmClock}
              tone="danger"
              trend="down"
              trendLabel={`${
                data.kpis.total_open > 0
                  ? Math.round(
                      (data.kpis.breached / data.kpis.total_open) * 100
                    )
                  : 0
              }%`}
            />
            <KpiCard
              label="Provisional credit out"
              value={formatCentsCompact(
                data.kpis.provisional_outstanding_cents
              )}
              icon={Banknote}
              tone="warning"
              sub="outstanding"
            />
            <KpiCard
              label="Avg time to Reg E"
              value={
                data.kpis.avg_hours_to_due != null
                  ? `${(data.kpis.avg_hours_to_due / 24).toFixed(1)}d`
                  : "—"
              }
              icon={Timer}
              sub="across open"
            />
            <KpiCard
              label="Resolved"
              value={data.kpis.resolved.toLocaleString()}
              icon={CheckCircle2}
              tone="success"
            />
            <KpiCard
              label="Recovery rate"
              value={`${
                data.kpis.resolved + data.kpis.denied > 0
                  ? Math.round(
                      (data.kpis.recovery_wins /
                        (data.kpis.resolved + data.kpis.denied)) *
                        100
                    )
                  : 0
              }%`}
              icon={TrendingUp}
              tone="success"
              sub={`${data.kpis.recovery_wins} credited`}
            />
          </div>

          {/* Charts row */}
          <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel
              title="Disputes opened"
              subtitle="Last 30 days"
              icon={<Activity className="h-4 w-4" />}
              className="lg:col-span-2"
            >
              {data.perDay.length === 0 ? (
                <Empty>No recent disputes.</Empty>
              ) : (
                <OpenedPerDayChart data={data.perDay} />
              )}
            </Panel>
            <Panel title="By dispute type" subtitle="Open disputes">
              {data.byType.length === 0 ? (
                <Empty>No open disputes.</Empty>
              ) : (
                <>
                  <TypeDonut data={data.byType} />
                  <div className="mt-3 space-y-1.5">
                    {data.byType.map((t, i) => (
                      <div
                        key={t.name}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="flex items-center gap-2 text-meridian-muted">
                          <span
                            className={`h-2.5 w-2.5 rounded-sm ${
                              i === 0 ? "bg-amber-500" : "bg-teal-500"
                            }`}
                          />
                          {t.name}
                        </span>
                        <span className="font-mono font-medium text-meridian-ink tnum">
                          {t.value.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Panel>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title="Pipeline by status" subtitle="All disputes in scope">
              <StatusBars data={data.byStatus} />
            </Panel>
            <Panel
              title="Top merchants"
              subtitle="By open-dispute volume"
              icon={<Gavel className="h-4 w-4" />}
            >
              {data.topMerchants.length === 0 ? (
                <Empty>No data.</Empty>
              ) : (
                <MerchantBars data={data.topMerchants} />
              )}
            </Panel>
            <Panel
              title="Risk exposure"
              subtitle="Open disputes on flagged merchants"
              icon={<ShieldAlert className="h-4 w-4 text-rose-400" />}
            >
              {data.riskExposure.length === 0 ? (
                <Empty>No exposure on watch/bad merchants.</Empty>
              ) : (
                <div className="space-y-3">
                  {data.riskExposure.map((r) => (
                    <div
                      key={r.risk}
                      className={`rounded-lg border p-3 ${
                        r.risk === "bad"
                          ? "border-rose-200 bg-rose-50"
                          : "border-amber-200 bg-amber-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-semibold uppercase tracking-wide ${
                            r.risk === "bad" ? "text-rose-700" : "text-amber-700"
                          }`}
                        >
                          {r.risk} merchants
                        </span>
                        <span className="font-mono text-sm font-semibold tnum text-meridian-ink">
                          {formatCentsCompact(r.exposure_cents)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-meridian-muted">
                        {r.dispute_count.toLocaleString()} open disputes at risk
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {/* Needs attention + recent activity */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel
              title="Needs attention"
              subtitle="Most-urgent open disputes"
              icon={<AlarmClock className="h-4 w-4 text-rose-400" />}
              className="lg:col-span-2"
              bodyClassName="p-0"
              action={
                <Link
                  href="/disputes"
                  className="flex items-center gap-1 text-xs font-medium text-meridian-deep hover:underline"
                >
                  View queue <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            >
              {data.attention.length === 0 ? (
                <Empty>No open disputes in your scope.</Empty>
              ) : (
                <ul className="divide-y divide-meridian-line">
                  {data.attention.map((d) => {
                    const h =
                      d.hours_to_deadline === null
                        ? null
                        : Number(d.hours_to_deadline);
                    const tier = slaTier(h, d.sla_breached);
                    return (
                      <li key={d.dispute_id}>
                        <Link
                          href={`/disputes/${d.dispute_id}`}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-meridian-bg/60"
                        >
                          <TypeBadge type={d.dispute_type} />
                          <span className="font-mono text-sm font-medium text-meridian-deep">
                            #{d.dispute_id}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-meridian-ink">
                            {d.customer_name}
                            <span className="ml-2 text-xs text-slate-400">
                              {d.merchant_name}
                            </span>
                          </span>
                          <span className="font-mono text-sm tnum text-meridian-ink">
                            {formatCents(d.amount_cents)}
                          </span>
                          <SlaPill tier={tier} label={formatCountdown(h)} />
                          {d.sla_breached ? <BreachedBadge /> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel
              title="Recent activity"
              subtitle="Latest intake"
              icon={<Activity className="h-4 w-4" />}
              bodyClassName="p-0"
            >
              {data.activity.length === 0 ? (
                <Empty>No recent activity.</Empty>
              ) : (
                <ul className="divide-y divide-meridian-line">
                  {data.activity.map((a) => (
                    <li key={a.dispute_id}>
                      <Link
                        href={`/disputes/${a.dispute_id}`}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-meridian-bg/60"
                      >
                        <Avatar name={a.customer_name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-meridian-ink">
                              {a.customer_name}
                            </span>
                            <RiskBadge risk={a.merchant_risk} />
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <StatusBadge status={a.status} />
                            <span>{relativeTime(a.opened_at)}</span>
                          </div>
                        </div>
                        <span className="font-mono text-sm tnum text-meridian-ink">
                          {formatCents(a.amount_cents)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </AppShell>
  );
}
