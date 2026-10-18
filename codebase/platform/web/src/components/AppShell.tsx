import { Sidebar } from "./Sidebar";
import { TopBar, type Crumb } from "./TopBar";
import type { Session } from "@/lib/session";

export function AppShell({
  session,
  title,
  crumbs,
  children,
}: {
  session: Session;
  title: string;
  crumbs?: Crumb[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-meridian-bg">
      <Sidebar session={session} />
      <div className="pl-60">
        <TopBar session={session} title={title} crumbs={crumbs} />
        <main className="px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
