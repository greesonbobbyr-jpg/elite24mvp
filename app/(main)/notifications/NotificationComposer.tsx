"use client";

import { useActionState, useState } from "react";
import { postNotification, type NotificationState } from "../actions";
import { WhistleIcon } from "@/app/components/WhistleIcon";
import { Button } from "@/app/components/ui/Button";

const initialState: NotificationState = {};
const fieldClass =
  "w-full rounded-lg border border-red-600/25 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-red-500";

export function NotificationComposer() {
  const [state, formAction, pending] = useActionState(
    postNotification,
    initialState,
  );
  const [isTimeout, setIsTimeout] = useState(false);

  return (
    <form
      action={formAction}
      className={`e24-surface flex flex-col gap-3 rounded-2xl border p-5 transition ${
        isTimeout
          ? "border-red-500/70 shadow-[0_0_24px_rgba(220,38,38,0.35)]"
          : "border-red-600/30"
      }`}
    >
      <h2 className="e24-eyebrow relative z-10">Post to your team</h2>
      <input
        name="title"
        placeholder="Title"
        className={`relative z-10 ${fieldClass}`}
      />
      <textarea
        name="body"
        rows={3}
        placeholder="Write a note to your team…"
        className={`relative z-10 ${fieldClass}`}
      />

      {/* TIME OUT toggle — an obviously-urgent kind of notification that takes
          over players' screens until acknowledged. Posts `isTimeout` as "on". */}
      <label className="relative z-10 flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="isTimeout"
          checked={isTimeout}
          onChange={(e) => setIsTimeout(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-red-600"
        />
        <span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-red-500">
            <WhistleIcon className="h-4 w-4" />
            Send as TIME OUT
          </span>
          <span className="block text-xs text-zinc-500">
            Urgent — takes over every player&apos;s screen until they acknowledge it.
          </span>
        </span>
      </label>

      {state.error && (
        <p className="relative z-10 text-sm text-red-500">{state.error}</p>
      )}
      <Button type="submit" disabled={pending} className="relative z-10 self-start">
        {pending ? (
          "Posting…"
        ) : isTimeout ? (
          <span className="inline-flex items-center gap-1.5">
            <WhistleIcon className="h-4 w-4" />
            Send TIME OUT to team
          </span>
        ) : (
          "Post to team"
        )}
      </Button>
    </form>
  );
}
