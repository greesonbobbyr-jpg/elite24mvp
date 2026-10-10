"use client";

import { useActionState } from "react";
import { addOwnEmail, type EmailState } from "./actions";
import { Button } from "@/app/components/ui/Button";
import { fieldClass, labelClass } from "@/app/components/ui/Field";

export function EmailForm() {
  const [state, action, pending] = useActionState<EmailState, FormData>(addOwnEmail, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className={fieldClass} />
        <p className="mt-1 text-xs text-subtle">
          Using a parent&apos;s email? Add +name before the @ (parent+jordan@gmail.com) so each kid keeps their own account.
        </p>
      </div>
      {state.error && <p className="text-sm font-semibold text-brand">{state.error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save my email"}</Button>
    </form>
  );
}
