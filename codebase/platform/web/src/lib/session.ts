import { cookies } from "next/headers";

const COOKIE_NAME = "meridian_session";

export type Session = {
  analystId: number;
  email: string;
  fullName: string;
  scope: string; // type_a | type_b | all
  role: string; // analyst | lead | admin
};

/**
 * Reads the httpOnly session cookie. Returns null if missing/invalid.
 * The cookie is a small JSON blob — for P0 there is no signing/password;
 * it just identifies which seeded analyst is "logged in".
 */
export function getSession(): Session | null {
  const raw = cookies().get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Session>;
    // Coerce analystId: BIGINT may serialize as a string; accept number or numeric string.
    const analystId = Number(parsed.analystId);
    if (
      Number.isFinite(analystId) &&
      typeof parsed.email === "string" &&
      typeof parsed.scope === "string"
    ) {
      return {
        analystId,
        email: parsed.email,
        fullName: parsed.fullName ?? parsed.email,
        scope: parsed.scope,
        role: parsed.role ?? "analyst",
      };
    }
  } catch {
    // fall through
  }
  return null;
}

export function setSession(session: Session): void {
  cookies().set(COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8, // 8h shift
  });
}

export function clearSession(): void {
  cookies().delete(COOKIE_NAME);
}

export const SESSION_COOKIE = COOKIE_NAME;
