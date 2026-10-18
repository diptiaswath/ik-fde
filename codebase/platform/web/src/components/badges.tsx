import {
  ShieldAlert,
  Eye,
  CreditCard,
  Globe,
  Banknote,
  Repeat,
  Store,
  type LucideIcon,
} from "lucide-react";
import type { Sla } from "@/lib/format";
import { initials } from "@/lib/format";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Merchant risk
// ---------------------------------------------------------------------------
export function RiskBadge({ risk }: { risk: string }) {
  if (risk === "watch") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200">
        <Eye className="h-3 w-3" /> Watch
      </span>
    );
  }
  if (risk === "bad") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-rose-700 ring-1 ring-inset ring-rose-200">
        <ShieldAlert className="h-3 w-3" /> Bad
      </span>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// SLA countdown chip — color by urgency
// ---------------------------------------------------------------------------
const SLA_CLASSES: Record<Sla, string> = {
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export function SlaPill({
  tier,
  label,
  size = "sm",
}: {
  tier: Sla;
  label: string;
  size?: "sm" | "lg";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md font-semibold tnum ring-1 ring-inset",
        SLA_CLASSES[tier],
        size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"
      )}
    >
      {label}
    </span>
  );
}

export function BreachedBadge() {
  return (
    <span className="pulse-breach inline-flex items-center rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
      Breached
    </span>
  );
}

// ---------------------------------------------------------------------------
// Dispute / ticket status pill
// ---------------------------------------------------------------------------
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    intake: "bg-slate-100 text-slate-600 ring-slate-200",
    investigating: "bg-sky-50 text-sky-700 ring-sky-200",
    provisional_credit: "bg-teal-50 text-teal-700 ring-teal-200",
    resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    denied: "bg-slate-100 text-slate-500 ring-slate-200",
    open: "bg-sky-50 text-sky-700 ring-sky-200",
    pending: "bg-amber-50 text-amber-700 ring-amber-200",
    closed: "bg-slate-100 text-slate-500 ring-slate-200",
  };
  const dot: Record<string, string> = {
    intake: "bg-slate-400",
    investigating: "bg-sky-500",
    provisional_credit: "bg-teal-500",
    resolved: "bg-emerald-500",
    denied: "bg-slate-400",
    open: "bg-sky-500",
    pending: "bg-amber-500",
    closed: "bg-slate-400",
  };
  const cls = map[status] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset",
        cls
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot[status] ?? "bg-slate-400")} />
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Dispute type chip
// ---------------------------------------------------------------------------
export function TypeBadge({ type }: { type: string }) {
  const isA = type === "A";
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[11px] font-bold ring-1 ring-inset",
        isA
          ? "bg-meridian-goldSoft text-[#8a6a23] ring-amber-200"
          : "bg-teal-50 text-teal-700 ring-teal-200"
      )}
      title={
        isA
          ? "Type A — card fraud / unauthorized"
          : "Type B — merchant / quality"
      }
    >
      {type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Avatar with initials
// ---------------------------------------------------------------------------
const AVATAR_TONES = [
  "bg-teal-100 text-teal-800",
  "bg-amber-100 text-amber-800",
  "bg-sky-100 text-sky-800",
  "bg-rose-100 text-rose-800",
  "bg-emerald-100 text-emerald-800",
  "bg-violet-100 text-violet-800",
];

function toneFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export function Avatar({
  name,
  size = "sm",
}: {
  name: string | null | undefined;
  size?: "xs" | "sm" | "md";
}) {
  const label = name?.trim() || "Unassigned";
  const dim =
    size === "md" ? "h-9 w-9 text-sm" : size === "xs" ? "h-5 w-5 text-[9px]" : "h-7 w-7 text-[11px]";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        dim,
        name ? toneFor(label) : "bg-slate-100 text-slate-400"
      )}
      title={label}
    >
      {initials(name)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Channel icon (transactions + tickets)
// ---------------------------------------------------------------------------
const CHANNEL_ICONS: Record<string, LucideIcon> = {
  pos: CreditCard,
  online: Globe,
  atm: Banknote,
  recurring: Repeat,
  card: CreditCard,
};

export function ChannelIcon({ channel }: { channel: string }) {
  const Icon = CHANNEL_ICONS[channel] ?? Store;
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-600">
      <Icon className="h-3.5 w-3.5 text-slate-400" />
      <span className="capitalize">{channel}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Customer segment badge
// ---------------------------------------------------------------------------
export function SegmentBadge({ segment }: { segment: string }) {
  const map: Record<string, string> = {
    premier: "bg-meridian-goldSoft text-[#8a6a23] ring-amber-200",
    small_business: "bg-sky-50 text-sky-700 ring-sky-200",
    retail: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  const cls = map[segment] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset",
        cls
      )}
    >
      {segment.replace(/_/g, " ")}
    </span>
  );
}
