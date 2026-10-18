"use server";

import { redirect } from "next/navigation";
import { findAnalystByEmail } from "@/lib/queries";
import { setSession } from "@/lib/session";

export async function loginAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Enter your analyst email." };
  }

  let analyst;
  try {
    analyst = await findAnalystByEmail(email);
  } catch {
    return {
      error:
        "Could not reach the Meridian database. Is Postgres running? (see README)",
    };
  }

  if (!analyst) {
    return { error: `No analyst found for "${email}".` };
  }

  setSession({
    analystId: analyst.analyst_id,
    email: analyst.email,
    fullName: analyst.full_name,
    scope: analyst.scope,
    role: analyst.role,
  });

  redirect("/");
}
