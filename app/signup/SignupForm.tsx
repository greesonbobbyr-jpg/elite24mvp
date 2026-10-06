"use client";

import { useActionState } from "react";
import { signup, type SignupState } from "./actions";
import { TeamBrandingFields } from "@/app/components/TeamBrandingFields";

const initialState: SignupState = {};
const field =
  "w-full rounded-lg border border-field-line bg-field px-3 py-2.5 text-sm text-ink outline-none transition focus:border-accent-edge";
const label = "mb-1 block text-xs font-medium text-muted";

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
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
        <div>
          <label htmlFor="username" className={label}>
            Username <span className="text-subtle">(optional — log in with it or your email)</span>
          </label>
          <input
            id="username"
            name="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            maxLength={21}
            placeholder="e.g. coachgary"
            className={field}
          />
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

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
          Your team
        </p>
        <div>
          <label htmlFor="teamName" className={label}>Team name</label>
          <input id="teamName" name="teamName" required placeholder="Team name" className={field} />
        </div>
        <TeamBrandingFields />
      </div>

      {state.error && <p className="text-sm text-brand">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 w-full rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent transition hover:bg-accent-hover active:scale-[0.99] disabled:bg-raised-3 disabled:text-muted"
      >
        {pending ? "Creating your team…" : "Create team & sign in"}
      </button>
    </form>
  );
}
