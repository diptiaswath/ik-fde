import { Search, Bell } from "lucide-react";
import type { Session } from "@/lib/session";
import { initials } from "@/lib/format";

export type Crumb = { label: string; href?: string };

export function TopBar({
  session,
  title,
  crumbs,
}: {
  session: Session;
  title: string;
  crumbs?: Crumb[];
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-meridian-line bg-white px-6">
      <div className="min-w-0 flex-1">
        {crumbs && crumbs.length > 0 ? (
          <nav className="mb-0.5 flex items-center gap-1.5 text-xs text-meridian-muted">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 ? <span className="text-slate-300">/</span> : null}
                <span className={i === crumbs.length - 1 ? "text-slate-500" : ""}>
                  {c.label}
                </span>
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="truncate text-[15px] font-semibold tracking-tight text-meridian-ink">
          {title}
        </h1>
      </div>

      {/* Global search (placeholder) */}
      <div className="hidden md:block">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search disputes, customers, txns…"
            className="h-9 w-72 rounded-lg border border-meridian-line bg-meridian-bg/60 pl-9 pr-3 text-sm text-meridian-ink placeholder:text-slate-400 focus:border-meridian-primary focus:bg-white focus:outline-none focus:ring-1 focus:ring-meridian-primary"
          />
        </div>
      </div>

      <button
        type="button"
        title="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-meridian-line bg-white text-slate-500 transition-colors hover:bg-meridian-bg"
      >
        <Bell className="h-[18px] w-[18px]" />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500 ring-2 ring-white" />
      </button>

      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-meridian-primary/10 text-xs font-semibold text-meridian-deep ring-1 ring-inset ring-meridian-primary/20">
        {initials(session.fullName)}
      </span>
    </header>
  );
}
