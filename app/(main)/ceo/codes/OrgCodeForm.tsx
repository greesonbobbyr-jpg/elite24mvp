"use client";

import { useActionState, useState } from "react";
import { createOrgCode, type InviteFormState } from "@/app/(main)/invites/actions";
import { InviteCard } from "@/app/components/InviteCard";
import { Button } from "@/app/components/ui/Button";
import { fieldClass, labelClass } from "@/app/components/ui/Field";

// Make an organization code (the CEO only): whoever gets it can start one
// organization — they become its org admin.
export function OrgCodeForm() {
  const [state, action, pending] = useActionState<InviteFormState, FormData>(createOrgCode, {});
  const [again, setAgain] = useState(false);
  if (state.made && !again) {
    return (
      <div className="flex flex-col gap-3">
        <InviteCard {...state.made} />
        <Button type="button" size="sm" variant="secondary" className="self-start" onClick={() => setAgain(true)}>
          Make another code
        </Button>
      </div>
    );
  }
  return (
    <form action={(fd) => { setAgain(false); return action(fd); }} className="flex flex-col gap-3">
      <div>
        <label htmlFor="org-code-for" className={labelClass}>Who is it for?</label>
        <input id="org-code-for" name="label" required maxLength={60} placeholder="e.g. Westside Hoops Academy" className={fieldClass} />
      </div>
      {state.error && <p className="text-sm font-semibold text-brand">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Making it…" : "Make organization code"}
      </Button>
    </form>
  );
}
