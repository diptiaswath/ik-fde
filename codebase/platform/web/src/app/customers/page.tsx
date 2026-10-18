import Link from "next/link";
import { Users } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Panel, Empty, DbErrorPanel } from "@/components/ui";
import { getCustomersWithDisputes, type CustomerSummary } from "@/lib/queries";
import { Avatar, SegmentBadge } from "@/components/badges";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const session = requireSession();

  let rows: CustomerSummary[] = [];
  let dbError = false;
  try {
    rows = await getCustomersWithDisputes(session.scope);
  } catch {
    dbError = true;
  }

  return (
    <AppShell session={session} title="Customers" crumbs={[{ label: "Customer 360" }]}>
      <p className="mb-5 text-sm text-meridian-muted">
        Customers ranked by dispute activity in your scope · open any profile for
        the full 360 view
      </p>

      {dbError ? (
        <DbErrorPanel />
      ) : (
        <Panel bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr className="border-b border-meridian-line">
                  <th className="bg-white px-4 py-2.5 shadow-[inset_0_-1px_0_0_#E6E9E6]">Customer</th>
                  <th className="bg-white px-4 py-2.5 shadow-[inset_0_-1px_0_0_#E6E9E6]">Segment</th>
                  <th className="bg-white px-4 py-2.5 shadow-[inset_0_-1px_0_0_#E6E9E6] text-right">Disputes</th>
                  <th className="bg-white px-4 py-2.5 shadow-[inset_0_-1px_0_0_#E6E9E6] text-right">Breached</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-meridian-line">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <Empty icon={<Users className="h-7 w-7" />}>
                        No customers with disputes in your scope.
                      </Empty>
                    </td>
                  </tr>
                ) : (
                  rows.map((c) => (
                    <tr
                      key={c.customer_id}
                      className="transition-colors hover:bg-meridian-bg/60"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`/customers/${c.customer_id}`}
                          className="flex items-center gap-3"
                        >
                          <Avatar name={c.full_name} size="sm" />
                          <div>
                            <div className="font-medium text-meridian-ink hover:underline">
                              {c.full_name}
                            </div>
                            <div className="text-xs text-slate-400">
                              {c.email}
                            </div>
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <SegmentBadge segment={c.segment} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium tnum text-meridian-ink">
                        {c.dispute_count}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-medium tnum">
                        {c.breached_count > 0 ? (
                          <span className="text-rose-600">
                            {c.breached_count}
                          </span>
                        ) : (
                          <span className="text-slate-300">0</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </AppShell>
  );
}
