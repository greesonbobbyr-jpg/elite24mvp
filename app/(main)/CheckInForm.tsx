"use client";

import { useActionState } from "react";
import { submitCheckIn, type CheckInState } from "./actions";
import { Button } from "@/app/components/ui/Button";

const initialState: CheckInState = {};

export function CheckInForm() {
  const [state, formAction, pending] = useActionState(
    submitCheckIn,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
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
