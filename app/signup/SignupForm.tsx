"use client";

import { useActionState } from "react";
import { signup, type SignupState } from "./actions";
import { Button } from "@/app/components/ui/Button";
import { checkClass, fieldClass, labelClass } from "@/app/components/ui/Field";

const initialState: SignupState = {};

// Step 1: one account for everyone — players, parents, coaches, organizers.
export function SignupForm({ next, code }: { next: string | null; code: string | null }) {
  const [state, formAction, pending] = useActionState(signup, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      {code && <input type="hidden" name="code" value={code} />}
      <div>
        <label htmlFor="name" className={labelClass}>Your name</label>
        <input id="name" name="name" required maxLength={60} autoComplete="name" className={fieldClass} />
      </div>
      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className={fieldClass} />
        <p className="mt-1 text-xs text-subtle">
          You&apos;ll log in with it. Using a parent&apos;s email? Add +name before the @ (parent+jordan@gmail.com) so each
          kid gets their own account.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="password" className={labelClass}>Password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="confirm" className={labelClass}>Again</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} className={fieldClass} />
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm text-ink-mid">
        <input type="checkbox" name="ageOk" required className={`${checkClass} mt-0.5`} />
        <span>I&apos;m 13 or older, or I&apos;m a parent or guardian setting this up.</span>
      </label>

      {state.error && <p className="text-sm font-semibold text-brand">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating your account…" : "Create account"}
      </Button>
    </form>
  );
}
