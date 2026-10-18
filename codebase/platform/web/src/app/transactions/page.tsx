import Link from "next/link";
import { Search, X, ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Panel, Empty, DbErrorPanel } from "@/components/ui";
import { getTransactions, type TxnRow } from "@/lib/queries";
import { formatCents, formatDateTime } from "@/lib/format";
import { RiskBadge, ChannelIcon } from "@/components/badges";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { account_id?: string; page?: string };
}) {
  const session = requireSession();

  const accountId = (searchParams.account_id ?? "").trim();
  const validAccount = /^\d+$/.test(accountId) ? accountId : "";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let rows: TxnRow[] = [];
  let dbError = false;
  try {
    rows = await getTransactions({
      accountId: validAccount || undefined,
      limit: PAGE_SIZE + 1,
      offset,
    });
  } catch {
    dbError = true;
  }

  const hasNext = rows.length > PAGE_SIZE;
  const pageRows = rows.slice(0, PAGE_SIZE);

  const qs = (p: number) => {
    const sp = new URLSearchParams();
    if (validAccount) sp.set("account_id", validAccount);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `?${s}` : "";
  };

  return (
    <AppShell session={session} title="Transactions" crumbs={[{ label: "Explorer" }]}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-meridian-muted">
          Filter by account · results are always paginated and capped for speed
        </p>
        <form method="get" className="flex items-end gap-2">
          <div className="relative">
            <Receipt className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="account_id"
              name="account_id"
              inputMode="numeric"
              defaultValue={validAccount}
              placeholder="Account ID, e.g. 5134"
              className="h-9 w-56 rounded-lg border border-meridian-line bg-white pl-9 pr-3 text-sm text-meridian-ink placeholder:text-slate-400 focus:border-meridian-primary focus:outline-none focus:ring-1 focus:ring-meridian-primary"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-meridian-primary px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-meridian-deep"
          >
            <Search className="h-4 w-4" /> Search
          </button>
          {validAccount ? (
            <Link
              href="/transactions"
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-meridian-line bg-white px-3 text-sm text-meridian-muted hover:bg-meridian-bg"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </Link>
          ) : null}
        </form>
      </div>

      {validAccount ? (
        <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-meridian-line bg-white px-3 py-1.5 text-xs text-meridian-muted shadow-card">
          Filtered to account
          <span className="font-mono font-medium text-meridian-deep">
            #{validAccount}
          </span>
        </div>
      ) : null}

      {dbError ? (
        <DbErrorPanel compact />
      ) : (
        <Panel bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr className="border-b border-meridian-line">
                  <th className="bg-white px-4 py-2.5 shadow-[inset_0_-1px_0_0_#E6E9E6]">Txn</th>
                  <th className="bg-white px-4 py-2.5 shadow-[inset_0_-1px_0_0_#E6E9E6]">Date</th>
                  <th className="bg-white px-4 py-2.5 shadow-[inset_0_-1px_0_0_#E6E9E6]">Account</th>
                  <th className="bg-white px-4 py-2.5 shadow-[inset_0_-1px_0_0_#E6E9E6]">Merchant</th>
                  <th className="bg-white px-4 py-2.5 shadow-[inset_0_-1px_0_0_#E6E9E6]">Channel</th>
                  <th className="bg-white px-4 py-2.5 shadow-[inset_0_-1px_0_0_#E6E9E6] text-right">Amount</th>
                  <th className="bg-white px-4 py-2.5 shadow-[inset_0_-1px_0_0_#E6E9E6]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-meridian-line">
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <Empty icon={<Receipt className="h-7 w-7" />}>
                        No transactions found.
                      </Empty>
                    </td>
                  </tr>
                ) : (
                  pageRows.map((t) => (
                    <tr
                      key={t.txn_id}
                      className="transition-colors hover:bg-meridian-bg/60"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                        #{t.txn_id}
                      </td>
                      <td className="px-4 py-2.5 text-meridian-muted">
                        {formatDateTime(t.txn_ts)}
                      </td>
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/transactions?account_id=${t.account_id}`}
                          className="font-mono text-meridian-deep hover:underline"
                        >
                          #{t.account_id}
                        </Link>
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
                      <td className="px-4 py-2.5 text-right font-mono font-medium tnum text-meridian-ink">
                        {formatCents(t.amount_cents)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="capitalize text-meridian-muted">
                          {t.status}
                        </span>
                        {t.is_disputed ? (
                          <span className="ml-2 rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                            disputed
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-meridian-muted">
          Page {page} · showing {pageRows.length} rows
        </span>
        <div className="flex gap-2">
          <PageLink href={`/transactions${qs(page - 1)}`} disabled={page <= 1}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </PageLink>
          <PageLink href={`/transactions${qs(page + 1)}`} disabled={!hasNext}>
            Next <ChevronRight className="h-4 w-4" />
          </PageLink>
        </div>
      </div>
    </AppShell>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const base =
    "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm shadow-card";
  if (disabled) {
    return (
      <span className={cn(base, "border-meridian-line bg-white text-slate-300")}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        base,
        "border-meridian-line bg-white text-meridian-ink hover:bg-meridian-bg"
      )}
    >
      {children}
    </Link>
  );
}
