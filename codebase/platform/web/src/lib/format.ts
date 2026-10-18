// Money is stored as integer cents everywhere in the Meridian schema.
export function formatCents(cents: number | string | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  const n = typeof cents === "string" ? Number(cents) : cents;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n / 100);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

/** Compact currency for KPI cards, e.g. $601.4K, $1.2M. Input is cents. */
export function formatCentsCompact(
  cents: number | string | null | undefined
): string {
  if (cents === null || cents === undefined) return "—";
  const n = typeof cents === "string" ? Number(cents) : cents;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n / 100);
}

/** Up to two-letter initials from a person / merchant name. */
export function initials(name: string | null | undefined): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** A short, human relative time like "3h ago" / "2d ago". */
export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}

export type Sla = "red" | "amber" | "green";

/**
 * Reg E countdown tier. red if breached or <24h, amber if <72h, green otherwise.
 */
export function slaTier(
  hoursToDeadline: number | null | undefined,
  slaBreached: boolean
): Sla {
  if (slaBreached) return "red";
  if (hoursToDeadline === null || hoursToDeadline === undefined) return "green";
  if (hoursToDeadline < 24) return "red";
  if (hoursToDeadline < 72) return "amber";
  return "green";
}

export function formatCountdown(
  hoursToDeadline: number | null | undefined
): string {
  if (hoursToDeadline === null || hoursToDeadline === undefined) return "—";
  const h = hoursToDeadline;
  if (h < 0) {
    const overdue = Math.abs(h);
    if (overdue < 24) return `${Math.round(overdue)}h overdue`;
    return `${Math.floor(overdue / 24)}d overdue`;
  }
  if (h < 24) return `${Math.round(h)}h left`;
  const days = Math.floor(h / 24);
  const rem = Math.round(h % 24);
  return rem > 0 ? `${days}d ${rem}h left` : `${days}d left`;
}
