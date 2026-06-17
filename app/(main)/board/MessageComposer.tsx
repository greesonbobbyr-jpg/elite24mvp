"use client";

import { useActionState } from "react";
import { postMessage, type BoardState } from "./actions";

const initialState: BoardState = {};

export function MessageComposer() {
  const [state, formAction, pending] = useActionState(
    postMessage,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <textarea
        name="body"
        required
        rows={2}
        placeholder="Message your team…"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-red-500"
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-end rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "Posting…" : "Post"}
      </button>
    </form>
  );
}
