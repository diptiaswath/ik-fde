import { BookText, FileText } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Panel, Empty, DbErrorPanel } from "@/components/ui";
import { getPolicyChunks, type PolicyChunk } from "@/lib/queries";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const REG_TONES: Record<string, string> = {
  "Reg E": "bg-teal-50 text-teal-700 ring-teal-200",
  GLBA: "bg-sky-50 text-sky-700 ring-sky-200",
  SOC2: "bg-violet-50 text-violet-700 ring-violet-200",
  internal: "bg-slate-100 text-slate-600 ring-slate-200",
};

function RegBadge({ regRef }: { regRef: string | null }) {
  if (!regRef) return null;
  const tone =
    REG_TONES[regRef] ?? "bg-meridian-goldSoft text-[#8a6a23] ring-amber-200";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        tone
      )}
    >
      {regRef}
    </span>
  );
}

export default async function PoliciesPage() {
  const session = requireSession();

  let chunks: PolicyChunk[] = [];
  let dbError = false;
  try {
    chunks = await getPolicyChunks();
  } catch {
    dbError = true;
  }

  // Group by doc_title preserving order.
  const groups: { title: string; items: PolicyChunk[] }[] = [];
  const idx = new Map<string, number>();
  for (const c of chunks) {
    if (!idx.has(c.doc_title)) {
      idx.set(c.doc_title, groups.length);
      groups.push({ title: c.doc_title, items: [] });
    }
    groups[idx.get(c.doc_title)!].items.push(c);
  }

  return (
    <AppShell session={session} title="Policies" crumbs={[{ label: "Knowledge base" }]}>
      <p className="mb-5 text-sm text-meridian-muted">
        Dispute-operations policy &amp; compliance reference · grouped by document
      </p>

      {dbError ? (
        <DbErrorPanel />
      ) : groups.length === 0 ? (
        <Empty icon={<BookText className="h-7 w-7" />}>
          No policy documents available.
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {groups.map((g) => (
            <Panel
              key={g.title}
              title={g.title}
              subtitle={`${g.items.length} section${g.items.length === 1 ? "" : "s"}`}
              icon={<FileText className="h-4 w-4" />}
              bodyClassName="p-0"
            >
              <ul className="divide-y divide-meridian-line">
                {g.items.map((c) => (
                  <li key={c.chunk_id} className="px-4 py-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-medium text-meridian-ink">
                        {c.section}
                      </h3>
                      <RegBadge regRef={c.reg_ref} />
                    </div>
                    <p className="text-sm leading-relaxed text-meridian-muted">
                      {c.content}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </AppShell>
  );
}
