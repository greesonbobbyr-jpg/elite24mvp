"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import { Button } from "@/app/components/ui/Button";
import { fieldClass, labelClass } from "@/app/components/ui/Field";

const initialState: LoginState = {};

// Email is the only login (owner, 2026-10-09). An older account that still
// has only a username can type it here once; the app then asks for an email.
export function LoginForm({ next }: { next: string | null }) {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label htmlFor="identifier" className={labelClass}>Email</label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          className={fieldClass}
        />
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={fieldClass} />
      </div>

      {state.error && <p className="text-sm font-semibold text-brand">{state.error}</p>}

      <Button type="submit" disabled={pending} className="mt-1 w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
