"use client";

import { useActionState } from "react";
import { submitCheckIn, type CheckInState } from "./actions";

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
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-900"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Check in"}
      </button>
    </form>
  );
}
