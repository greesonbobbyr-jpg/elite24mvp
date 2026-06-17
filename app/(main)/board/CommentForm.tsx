"use client";

import { useActionState, useEffect, useState } from "react";
import { postComment, type BoardState } from "./actions";

const initialState: BoardState = {};

export function CommentForm({ messageId }: { messageId: number }) {
  const [state, formAction, pending] = useActionState(postComment, initialState);
  const [body, setBody] = useState("");

  useEffect(() => {
    if (state.ok) setBody("");
  }, [state]);

  return (
    <form action={formAction} className="mt-1 flex flex-col gap-1">
      <input type="hidden" name="messageId" value={messageId} />
      <div className="flex items-center gap-2">
        <input
          name="body"
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-red-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {pending ? "…" : "Reply"}
        </button>
      </div>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
