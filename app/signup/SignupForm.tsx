"use client";

import { useActionState } from "react";
import { signup, type SignupState } from "./actions";

const initialState: SignupState = {};
const field =
  "w-full rounded-lg border border-red-600/25 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-red-500";
const label = "mb-1 block text-xs font-medium text-zinc-400";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          You (coach)
        </p>
        <div>
          <label htmlFor="name" className={label}>Your name</label>
          <input id="name" name="name" required placeholder="Coach name" className={field} />
        </div>
        <div>
          <label htmlFor="email" className={label}>Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className={field} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="password" className={label}>Password</label>
            <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className={field} />
          </div>
          <div>
            <label htmlFor="confirm" className={label}>Confirm</label>
            <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} className={field} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-white/10 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Your team
        </p>
        <div>
          <label htmlFor="teamName" className={label}>Team name</label>
          <input id="teamName" name="teamName" required placeholder="Team name" className={field} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="logoUrl" className={label}>Logo URL <span className="text-zinc-600">(optional)</span></label>
            <input id="logoUrl" name="logoUrl" type="url" className={field} />
          </div>
          <div>
            <label htmlFor="accentColor" className={label}>Accent <span className="text-zinc-600">(optional)</span></label>
            <input id="accentColor" name="accentColor" className={field} />
          </div>
        </div>
      </div>

      {state.error && <p className="text-sm text-red-500">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 w-full rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? "Creating your team…" : "Create team & sign in"}
      </button>
    </form>
  );
}
