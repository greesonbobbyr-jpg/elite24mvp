"use client";

import { useActionState } from "react";
import { changePassword, type PasswordState } from "./actions";
import { Button } from "@/app/components/ui/Button";
import { fieldClass, labelClass } from "@/app/components/ui/Field";

const initial: PasswordState = {};

export function PasswordForm({ minLength }: { minLength: number }) {
  const [state, formAction, pending] = useActionState(changePassword, initial);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="current" className={labelClass}>Current password</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required className={fieldClass} />
      </div>
      <div>
        <label htmlFor="next" className={labelClass}>New password</label>
        <input id="next" name="next" type="password" autoComplete="new-password" required minLength={minLength} className={fieldClass} />
        <p className="mt-1 text-xs text-subtle">At least {minLength} characters.</p>
      </div>
      <div>
        <label htmlFor="confirm" className={labelClass}>New password again</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={minLength} className={fieldClass} />
      </div>
      {state.error && <p className="text-sm text-brand">{state.error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save new password"}</Button>
    </form>
  );
}
