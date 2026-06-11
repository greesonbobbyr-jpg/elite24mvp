"use client";

import { useActionState } from "react";
import { postNotification, type NotificationState } from "../actions";

const initialState: NotificationState = {};
const fieldClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-red-500";

export function NotificationComposer() {
  const [state, formAction, pending] = useActionState(
    postNotification,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-zinc-800 p-5"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Post to your team
      </h2>
      <input name="title" placeholder="Title" className={fieldClass} />
      <textarea
        name="body"
        rows={3}
        placeholder="Write a note to your team…"
        className={fieldClass}
      />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? "Posting…" : "Post to team"}
      </button>
    </form>
  );
}
