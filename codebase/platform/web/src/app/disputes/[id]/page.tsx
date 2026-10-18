import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  MessageSquarePlus,
  ArrowUpCircle,
  Database,
  Ticket as TicketIcon,
  FileText,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Panel, Field, Empty } from "@/components/ui";
import {
  getDispute,
  getEvidence,
  getDisputeTickets,
  type EvidenceRow,
} from "@/lib/queries";
import {
  formatCents,
  formatCountdown,
  formatDateTime,
  slaTier,
} from "@/lib/format";
import {
  RiskBadge,
  SlaPill,
  BreachedBadge,
  StatusBadge,
  TypeBadge,
  Avatar,
  ChannelIcon,
  SegmentBadge,
} from "@/components/badges";

export const dynamic = "force-dynamic";

export default async function DisputeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = requireSession();
  if (!/^\d+$/.test(params.id)) notFound();

  const dispute = await getDispute(params.id);
  if (!dispute) notFound();

  const [evidence, tickets] = await Promise.all([
    getEvidence(params.id),
    getDisputeTickets(params.id),
  ]);

  const hours =
    dispute.reg_e_due_at === null
      ? null
      : (new Date(dispute.reg_e_due_at).getTime() - Date.now()) / 3_600_000;
  const tier = slaTier(hours, dispute.sla_breached);

  return (
    <AppShell
      session={session}
      title={`Dispute #${dispute.dispute_id}`}
      crumbs={[{ label: "Disputes" }, { label: `#${dispute.dispute_id}` }]}
    >
      <Link
        href="/disputes"
        className="mb-3 inline-flex items-center gap-1 text-sm text-meridian-deep hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Dispute queue
      </Link>

      {/* Header card */}
      <div className="mb-5 rounded-lg border border-meridian-line bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-xl font-semibold text-meridian-ink">
              #{dispute.dispute_id}
            </h1>
            <TypeBadge type={dispute.dispute_type} />
            <StatusBadge status={dispute.status} />
            <span className="text-sm text-slate-400">
              reason {dispute.reason_code}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Reg E countdown
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <SlaPill tier={tier} label={formatCountdown(hours)} size="lg" />
                {dispute.sla_breached ? <BreachedBadge /> : null}
              </div>
            </div>
            <div className="border-l border-meridian-line pl-3 text-right">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Disputed amount
              </div>
              <div className="mt-0.5 font-mono text-xl font-semibold tnum text-meridian-ink">
                {formatCents(dispute.amount_cents)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {dispute.provisional_credit_error ? (
        <div className="pulse-breach mb-5 flex items-start gap-3 rounded-lg border-2 border-rose-300 bg-rose-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <div className="font-semibold text-rose-800">
              Provisional-credit error flagged
            </div>
            <p className="mt-1 text-sm text-rose-700">
              This dispute has a recorded provisional-credit error. The credit of{" "}
              <span className="font-mono font-semibold">
                {formatCents(dispute.provisional_credit_cents)}
              </span>{" "}
              may have been issued incorrectly — verify against Reg E
              provisional-credit rules before resolving.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel
            title="Disputed transaction"
            icon={<Database className="h-4 w-4" />}
          >
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Field label="Txn ID">
                <span className="font-mono">#{dispute.txn_id}</span>
              </Field>
              <Field label="Amount">
                <span className="font-mono font-medium tnum">
                  {formatCents(dispute.amount_cents)} {dispute.currency}
                </span>
              </Field>
              <Field label="Date">{formatDateTime(dispute.txn_ts)}</Field>
              <Field label="Channel">
                <ChannelIcon channel={dispute.channel} />
              </Field>
              <Field label="Txn status">
                <span className="capitalize">{dispute.txn_status}</span>
              </Field>
              <Field label="Account">
                <Link
                  href={`/transactions?account_id=${dispute.account_id}`}
                  className="font-mono text-meridian-deep hover:underline"
                >
                  #{dispute.account_id}
                </Link>
              </Field>
              <Field label="Merchant">
                <span className="inline-flex items-center gap-2">
                  {dispute.merchant_name}
                  <RiskBadge risk={dispute.merchant_risk} />
                </span>
                <div className="text-xs text-slate-400">
                  {dispute.merchant_category} · {dispute.merchant_country}
                </div>
              </Field>
              <Field label="Reason code">{dispute.reason_code}</Field>
            </dl>
          </Panel>

          <Panel
            title={`Evidence (${evidence.length})`}
            subtitle="Gathered across source systems"
            icon={<FileText className="h-4 w-4" />}
          >
            {evidence.length === 0 ? (
              <Empty>No evidence gathered yet.</Empty>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {evidence.map((e) => (
                  <EvidenceCard key={e.evidence_id} e={e} />
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title={`Linked tickets (${tickets.length})`}
            icon={<TicketIcon className="h-4 w-4" />}
          >
            {tickets.length === 0 ? (
              <Empty>No tickets linked to this dispute.</Empty>
            ) : (
              <div className="space-y-2">
                {tickets.map((t) => (
                  <div
                    key={t.ticket_id}
                    className="rounded-lg border border-meridian-line p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">
                          #{t.ticket_id}
                        </span>
                        <span className="text-sm font-medium text-meridian-ink">
                          {t.subject}
                        </span>
                        <StatusBadge status={t.status} />
                        {t.is_duplicate ? (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                            duplicate
                            {t.duplicate_of ? ` of #${t.duplicate_of}` : ""}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-xs text-slate-400">
                        {t.channel} · {formatDateTime(t.created_at)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-meridian-muted">{t.body}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Action panel (visual only) */}
          <Panel title="Actions">
            <div className="space-y-2">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-meridian-primary px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-meridian-deep"
              >
                <CheckCircle2 className="h-4 w-4" /> Approve credit
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-meridian-line bg-white px-3 py-2.5 text-sm font-medium text-meridian-ink transition-colors hover:bg-meridian-bg"
              >
                <MessageSquarePlus className="h-4 w-4 text-slate-400" /> Request
                info
              </button>
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2.5 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-50"
              >
                <ArrowUpCircle className="h-4 w-4" /> Escalate
              </button>
            </div>
          </Panel>

          <Panel title="Customer">
            <div className="flex items-center gap-3">
              <Avatar name={dispute.customer_name} size="md" />
              <div className="min-w-0">
                <Link
                  href={`/customers/${dispute.customer_id}`}
                  className="font-medium text-meridian-deep hover:underline"
                >
                  {dispute.customer_name}
                </Link>
                <div className="truncate text-xs text-slate-500">
                  {dispute.customer_email}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <SegmentBadge segment={dispute.customer_segment} />
              <span className="font-mono text-xs text-slate-400">
                #{dispute.customer_id}
              </span>
            </div>
          </Panel>

          <Panel title="Provisional credit">
            <dl className="space-y-2.5">
              <Field label="Issued">
                {dispute.provisional_credit_issued ? "Yes" : "No"}
              </Field>
              <Field label="Amount">
                <span className="font-mono tnum">
                  {formatCents(dispute.provisional_credit_cents)}
                </span>
              </Field>
              <Field label="Error flagged">
                {dispute.provisional_credit_error ? (
                  <span className="font-semibold text-rose-600">Yes</span>
                ) : (
                  "No"
                )}
              </Field>
            </dl>
          </Panel>

          <Panel title="Reg E timeline">
            <dl className="space-y-2.5">
              <Field label="Opened">{formatDateTime(dispute.opened_at)}</Field>
              <Field label="Due">{formatDateTime(dispute.reg_e_due_at)}</Field>
              <Field label="Countdown">
                <SlaPill tier={tier} label={formatCountdown(hours)} />
              </Field>
              <Field label="Assigned">
                <span className="inline-flex items-center gap-2">
                  <Avatar name={dispute.assigned_analyst} size="xs" />
                  {dispute.assigned_analyst ?? "Unassigned"}
                </span>
              </Field>
            </dl>
          </Panel>

          {dispute.resolution ? (
            <Panel title="Resolution">
              <p className="text-sm capitalize text-meridian-ink">
                {dispute.resolution.replace(/_/g, " ")}
              </p>
            </Panel>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

function EvidenceCard({ e }: { e: EvidenceRow }) {
  return (
    <div className="rounded-lg border border-meridian-line bg-meridian-bg/40 p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="rounded bg-meridian-darkest px-1.5 py-0.5 font-mono text-[10px] font-medium text-teal-100">
            {e.source_system}
          </span>
          <span className="font-medium capitalize text-meridian-muted">
            {e.kind.replace(/_/g, " ")}
          </span>
        </div>
        <span className="text-slate-400">{formatDateTime(e.gathered_at)}</span>
      </div>
      <dl className="space-y-1 text-xs">
        {renderPayload(e.payload)}
      </dl>
    </div>
  );
}

// Render JSONB payload as a readable key/value list (one level), falling back to
// a code block for nested objects.
function renderPayload(payload: unknown): React.ReactNode {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const entries = Object.entries(payload as Record<string, unknown>);
    return entries.map(([k, v]) => (
      <div key={k} className="flex gap-2">
        <dt className="shrink-0 font-medium capitalize text-slate-400">
          {k.replace(/_/g, " ")}
        </dt>
        <dd className="min-w-0 break-words font-mono text-meridian-ink">
          {typeof v === "object" && v !== null
            ? JSON.stringify(v)
            : String(v)}
        </dd>
      </div>
    ));
  }
  return (
    <pre className="overflow-x-auto rounded bg-white p-2 font-mono text-[11px] text-meridian-ink">
      {JSON.stringify(payload, null, 2)}
    </pre>
  );
}
