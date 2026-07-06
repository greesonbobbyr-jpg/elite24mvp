"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};
const field =
  "w-full rounded-lg border border-red-600/25 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-red-500";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div>
        <label htmlFor="identifier" className="mb-1 block text-xs font-medium text-zinc-400">
          Email or username
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          required
          className={field}
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-xs font-medium text-zinc-400">
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

      {state.error && <p className="text-sm text-red-500">{state.error}</p>}

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
