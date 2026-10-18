import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CreditCard,
  Landmark,
  Gavel,
  TrendingUp,
  Receipt,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Panel, Field, Empty } from "@/components/ui";
import { SpendArea } from "@/components/DashboardCharts";
import {
  getCustomer,
  getCustomerAccounts,
  getCustomerTransactions,
  getCustomerDisputes,
} from "@/lib/queries";
import {
  formatCents,
  formatDate,
  formatDateTime,
  formatCountdown,
  slaTier,
} from "@/lib/format";
import {
  RiskBadge,
  SlaPill,
  StatusBadge,
  TypeBadge,
  Avatar,
  SegmentBadge,
  ChannelIcon,
} from "@/components/badges";

export const dynamic = "force-dynamic";

export default async function CustomerPage({
  params,
}: {
  params: { id: string };
}) {
  const session = requireSession();
  if (!/^\d+$/.test(params.id)) notFound();

  const customer = await getCustomer(params.id);
  if (!customer) notFound();

  const [accounts, txns, disputes] = await Promise.all([
    getCustomerAccounts(params.id),
    getCustomerTransactions(params.id),
    getCustomerDisputes(params.id),
  ]);

  // Build a small spend series (newest-first txns → chronological buckets by day).
  const spendByDay = new Map<string, number>();
  for (const t of txns) {
    const key = new Date(t.txn_ts).toISOString().slice(0, 10);
    spendByDay.set(key, (spendByDay.get(key) ?? 0) + Number(t.amount_cents) / 100);
  }
  const spendSeries = Array.from(spendByDay.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, spend]) => ({
      label: new Date(day).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      spend: Math.round(spend),
    }));

  const breachedCount = disputes.filter((d) => d.sla_breached).length;

  return (
    <AppShell
      session={session}
      title={customer.full_name}
      crumbs={[{ label: "Customers" }, { label: `#${customer.customer_id}` }]}
    >
      {/* Profile header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-meridian-line bg-white p-5 shadow-card">
        <div className="flex items-center gap-4">
          <Avatar name={customer.full_name} size="md" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-meridian-ink">
                {customer.full_name}
              </h1>
              <SegmentBadge segment={customer.segment} />
            </div>
            <p className="text-sm text-meridian-muted">
              {customer.email} ·{" "}
              <span className="font-mono">#{customer.customer_id}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <HeaderStat label="Accounts" value={accounts.length.toString()} />
          <HeaderStat label="Disputes" value={disputes.length.toString()} />
          <HeaderStat
            label="Breached"
            value={breachedCount.toString()}
            tone={breachedCount > 0 ? "danger" : undefined}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5">
          <Panel title="Profile">
            <dl className="space-y-2.5">
              <Field label="Segment">
                <SegmentBadge segment={customer.segment} />
              </Field>
              <Field label="Date of birth">
                {formatDate(customer.date_of_birth)}
              </Field>
              <Field label="Joined">{formatDate(customer.joined_at)}</Field>
            </dl>
          </Panel>

          <Panel
            title={`Accounts (${accounts.length})`}
            icon={<Landmark className="h-4 w-4" />}
          >
            {accounts.length === 0 ? (
              <Empty>No accounts.</Empty>
            ) : (
              <ul className="space-y-2">
                {accounts.map((a) => (
                  <li
                    key={a.account_id}
                    className="rounded-lg border border-meridian-line p-3"
                  >
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/transactions?account_id=${a.account_id}`}
                        className="inline-flex items-center gap-2 font-mono text-sm text-meridian-deep hover:underline"
                      >
                        <CreditCard className="h-3.5 w-3.5 text-slate-400" />#
                        {a.account_id}
                      </Link>
                      <span className="text-xs capitalize text-meridian-muted">
                        {a.account_type} · {a.status}
                      </span>
                    </div>
                    {a.from_acquired_portfolio ? (
                      <span className="mt-1.5 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                        acquired portfolio
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {spendSeries.length > 1 ? (
            <Panel
              title="Recent spend"
              subtitle="Across last 25 transactions"
              icon={<TrendingUp className="h-4 w-4" />}
            >
              <SpendArea data={spendSeries} />
            </Panel>
          ) : null}
        </div>

        <div className="space-y-5 lg:col-span-2">
          <Panel
            title={`Disputes (${disputes.length})`}
            icon={<Gavel className="h-4 w-4" />}
            bodyClassName="p-0"
          >
            {disputes.length === 0 ? (
              <Empty>No disputes for this customer.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-meridian-bg/70 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-meridian-line">
                      <th className="px-4 py-2.5">Dispute</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5">Merchant</th>
                      <th className="px-4 py-2.5 text-right">Amount</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Reg E</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-meridian-line">
                    {disputes.map((d) => {
                      const hours =
                        (new Date(d.reg_e_due_at).getTime() - Date.now()) /
                        3_600_000;
                      const tier = slaTier(hours, d.sla_breached);
                      return (
                        <tr
                          key={d.dispute_id}
                          className="transition-colors hover:bg-meridian-bg/60"
                        >
                          <td className="px-4 py-2.5">
                            <Link
                              href={`/disputes/${d.dispute_id}`}
                              className="font-mono text-meridian-deep hover:underline"
                            >
                              #{d.dispute_id}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5">
                            <TypeBadge type={d.dispute_type} />
                          </td>
                          <td className="px-4 py-2.5 text-meridian-ink">
                            {d.merchant_name}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-medium tnum">
                            {formatCents(d.amount_cents)}
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={d.status} />
                          </td>
                          <td className="px-4 py-2.5">
                            <SlaPill
                              tier={tier}
                              label={formatCountdown(hours)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Recent transactions"
            subtitle="Last 25 across all accounts"
            icon={<Receipt className="h-4 w-4" />}
            bodyClassName="p-0"
          >
            {txns.length === 0 ? (
              <Empty>No transactions.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-meridian-bg/70 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr className="border-b border-meridian-line">
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Merchant</th>
                      <th className="px-4 py-2.5">Channel</th>
                      <th className="px-4 py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-meridian-line">
                    {txns.map((t) => (
                      <tr
                        key={t.txn_id}
                        className="transition-colors hover:bg-meridian-bg/60"
                      >
                        <td className="px-4 py-2.5 text-meridian-muted">
                          {formatDateTime(t.txn_ts)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center gap-2 text-meridian-ink">
                            {t.merchant_name}
                            <RiskBadge risk={t.merchant_risk} />
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <ChannelIcon channel={t.channel} />
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-medium tnum">
                          {formatCents(t.amount_cents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}

function HeaderStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger";
}) {
  return (
    <div className="text-right">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div
        className={`font-mono text-xl font-semibold tnum ${
          tone === "danger" ? "text-rose-600" : "text-meridian-ink"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
