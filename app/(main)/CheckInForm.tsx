"use client";

import { useActionState } from "react";
import { submitCheckIn, type CheckInState } from "./actions";
import { Button } from "@/app/components/ui/Button";

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
        <div className="rounded-lg border-l-2 border-red-500 bg-black/40 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-400">
            📝 From your last review
          </p>
          <p className="mt-0.5 text-sm italic text-zinc-300">“{lastNote}”</p>
        </div>
      )}
      <textarea
        name="reflection"
        required
        rows={4}
        placeholder="e.g. 100 free throws, then work on my left hand."
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/40"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="w-full bg-gradient-to-b from-red-500 to-red-700 shadow-lg shadow-red-900/40 hover:from-red-500 hover:to-red-600"
      >
        {pending ? "Saving…" : "Check in"}
      </Button>
    </form>
  );
}
