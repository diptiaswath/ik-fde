import { ArrowUpRight, ArrowDownRight, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  trendLabel,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "flat";
  trendLabel?: string;
  tone?: "neutral" | "danger" | "warning" | "success";
}) {
  const toneRing = {
    neutral: "text-meridian-deep bg-meridian-primary/10",
    danger: "text-rose-600 bg-rose-50",
    warning: "text-amber-600 bg-amber-50",
    success: "text-emerald-600 bg-emerald-50",
  }[tone];

  const valueColor = {
    neutral: "text-meridian-ink",
    danger: "text-rose-600",
    warning: "text-amber-700",
    success: "text-emerald-600",
  }[tone];

  // For trend chips: "up" is green here because callers pass semantic intent
  // already resolved (e.g. resolved-up = good, breached-up = bad). We keep the
  // arrow neutral-ish and let trendLabel carry meaning.
  const TrendIcon =
    trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const trendColor =
    trend === "up"
      ? "text-emerald-600 bg-emerald-50"
      : trend === "down"
        ? "text-rose-600 bg-rose-50"
        : "text-slate-500 bg-slate-100";

  return (
    <div className="rounded-lg border border-meridian-line bg-white p-4 shadow-card transition-shadow hover:shadow-cardHover">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-meridian-muted">{label}</span>
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md",
            toneRing
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className={cn("mt-2 font-mono text-2xl font-semibold tnum", valueColor)}>
        {value}
      </div>
      <div className="mt-1 flex items-center gap-2">
        {trend && trendLabel ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] font-semibold tnum",
              trendColor
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {trendLabel}
          </span>
        ) : null}
        {sub ? <span className="text-xs text-slate-400">{sub}</span> : null}
      </div>
    </div>
  );
}
