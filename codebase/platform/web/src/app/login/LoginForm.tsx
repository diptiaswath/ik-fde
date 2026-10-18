"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-meridian-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-meridian-deep disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm({ defaultEmail }: { defaultEmail?: string }) {
  const [state, formAction] = useFormState(loginAction, { error: null });
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-slate-700"
        >
          Analyst email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={defaultEmail}
          placeholder="analyst1@meridianbank.test"
          className="mt-1 w-full rounded-lg border border-meridian-line px-3 py-2 text-sm shadow-sm focus:border-meridian-primary focus:outline-none focus:ring-1 focus:ring-meridian-primary"
        />
      </div>
      {state.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
