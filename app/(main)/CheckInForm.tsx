"use client";

import { useActionState } from "react";
import { submitCheckIn, type CheckInState } from "./actions";
import { Button } from "@/app/components/ui/Button";
import { fieldClass } from "@/app/components/ui/Field";

const initialState: CheckInState = {};

// `lastNote` = the player's own "note to tomorrow-you" from their most recent
// Pro Review — their past self opens today's loop (investment → next trigger).
export function CheckInForm({ lastNote }: { lastNote?: string | null }) {
  const [state, formAction, pending] = useActionState(
    submitCheckIn,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {lastNote && (
        <div className="rounded-lg border border-line border-l-4 border-l-accent bg-sunken px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-2">
            📝 From your last review
          </p>
          <p className="mt-0.5 text-sm italic text-ink-mid">“{lastNote}”</p>
        </div>
      )}
      <textarea
        name="reflection"
        required
        rows={4}
        placeholder="e.g. 100 free throws, then work on my left hand."
        className={fieldClass}
      />
      {state.error && <p className="text-sm text-brand">{state.error}</p>}
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="w-full shadow-md"
      >
        {pending ? "Saving…" : "Check in"}
      </Button>
    </form>
  );
}
