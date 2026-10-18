import { redirect } from "next/navigation";
import { getSession, type Session } from "./session";

/**
 * Use at the top of any authed page. Redirects to /login if not signed in.
 */
export function requireSession(): Session {
  const session = getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}
