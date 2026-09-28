"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};
const field =
  "w-full rounded-lg border border-red-600/25 bg-field px-3 py-2.5 text-sm text-ink outline-none transition focus:border-red-500";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <label htmlFor="identifier" className="mb-1 block text-xs font-medium text-muted">
          Email or username
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          className={field}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-xs font-medium text-muted">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={field}
        />
      </div>

      {state.error && <p className="text-sm text-brand">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 w-full rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
