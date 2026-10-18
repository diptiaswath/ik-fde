import { cn } from "@/lib/cn";

/** A standard card chrome: 1px border, soft shadow, rounded-lg, header + body. */
export function Panel({
  title,
  subtitle,
  action,
  icon,
  className,
  bodyClassName,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-meridian-line bg-white shadow-card",
        className
      )}
    >
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-meridian-line px-4 py-3">
          <div className="flex items-center gap-2">
            {icon ? <span className="text-slate-400">{icon}</span> : null}
            <div>
              <h2 className="text-sm font-semibold text-meridian-ink">{title}</h2>
              {subtitle ? (
                <p className="text-xs text-meridian-muted">{subtitle}</p>
              ) : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-meridian-ink">{children}</dd>
    </div>
  );
}

export function Empty({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      {icon ? <div className="text-slate-300">{icon}</div> : null}
      <p className="text-sm text-slate-400">{children}</p>
    </div>
  );
}

export function DbErrorPanel({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
      <div className="font-semibold">Could not reach the Meridian database.</div>
      {!compact ? (
        <>
          <p className="mt-1">
            Start the local Postgres and load demo data, then reload:
          </p>
          <pre className="mt-2 overflow-x-auto rounded bg-rose-100 p-3 font-mono text-xs">
            cd platform/db {"&&"} docker compose up -d {"&&"} ./load.sh
          </pre>
        </>
      ) : null}
    </div>
  );
}
