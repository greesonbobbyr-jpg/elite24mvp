"use client";

import { useActionState, useEffect, useState } from "react";
import { postMessage, type BoardState } from "./actions";
import { TYPE_META, TAB_TYPES, SHORT_LABEL, type MessageType } from "./message-types";

const initialState: BoardState = {};
const EMOJIS = ["🏀", "🔥", "💪", "🐐", "⛹️", "🏆", "👏", "🎯", "💯", "🙌"];

export function MessageComposer({ isCoach }: { isCoach: boolean }) {
  const [state, formAction, pending] = useActionState(postMessage, initialState);
  const [body, setBody] = useState("");
  const [type, setType] = useState<MessageType>("REGULAR");

  // Clear the textarea after a successful post.
  useEffect(() => {
    if (state.ok) setBody("");
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {isCoach && (
        <div className="flex flex-wrap gap-2">
          {TAB_TYPES.map((t) => {
            const active = type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  active
                    ? `border-transparent ${TYPE_META[t].activeTab}`
                    : TYPE_META[t].idleTab
                }`}
              >
                {SHORT_LABEL[t]}
              </button>
            );
          })}
        </div>
      )}
      <input type="hidden" name="type" value={type} />

      <textarea
        name="body"
        required
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Message your team…"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-red-500"
      />

      <div className="flex flex-wrap items-center gap-1">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={`Add ${emoji}`}
            onClick={() => setBody((b) => b + emoji)}
            className="rounded-md px-1.5 py-1 text-lg leading-none hover:bg-zinc-800"
          >
            {emoji}
          </button>
        ))}
      </div>

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
