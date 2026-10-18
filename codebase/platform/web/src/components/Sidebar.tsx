"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Gavel,
  Receipt,
  Users,
  BookText,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import type { Session } from "@/lib/session";
import { initials } from "@/lib/format";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/disputes", label: "Disputes", icon: Gavel },
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/policies", label: "Policies", icon: BookText },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ session }: { session: Session }) {
  const pathname = usePathname();
  const scopeLabel =
    session.scope === "type_a"
      ? "Type A"
      : session.scope === "type_b"
        ? "Type B"
        : "All scopes";

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-meridian-darkest text-teal-50">
      {/* Wordmark */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-meridian-gold font-serif text-base font-bold text-[#0B2E2A] shadow-sm">
          M
        </span>
        <div className="leading-tight">
          <div className="font-serif text-base font-semibold tracking-tight text-white">
            Meridian Bank
          </div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-teal-300/70">
            Ops Console
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        <div className="px-2 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-300/50">
          Operations
        </div>
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-meridian-primary/20 text-white ring-1 ring-inset ring-meridian-primary/40"
                  : "text-teal-100/70 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0",
                  active
                    ? "text-meridian-gold"
                    : "text-teal-300/60 group-hover:text-teal-200"
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Signed-in analyst */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-meridian-primary/30 text-xs font-semibold text-teal-50 ring-1 ring-inset ring-meridian-primary/40">
            {initials(session.fullName)}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium text-white">
              {session.fullName}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="rounded bg-meridian-gold/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-meridian-gold">
                {scopeLabel}
              </span>
              <span className="truncate text-[10px] capitalize text-teal-300/60">
                {session.role}
              </span>
            </div>
          </div>
          <form action="/api/logout" method="post" className="shrink-0">
            <button
              type="submit"
              title="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-md text-teal-300/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
