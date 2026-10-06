"use client";

import { useActionState, useState } from "react";
import { postNotification, type NotificationState } from "../actions";
import { WhistleIcon } from "@/app/components/WhistleIcon";
import { Button } from "@/app/components/ui/Button";
import { fieldClass } from "@/app/components/ui/Field";

const initialState: NotificationState = {};

// canSendTimeout: server-decided (matrix send_timeout — HEAD_COACH/ORG_ADMIN).
// Staff without it never see the toggle; the server enforces it regardless.
export function NotificationComposer({
  canSendTimeout = true,
}: {
  canSendTimeout?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    postNotification,
    initialState,
  );
  const [isTimeout, setIsTimeout] = useState(false);

  return (
    <form
      action={formAction}
      className={`e24-surface flex flex-col gap-3 rounded-2xl p-5 transition ${
        isTimeout ? "border-2 border-accent-edge" : ""
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
          over players' screens until acknowledged. Posts `isTimeout` as "on".
          Hidden entirely from staff without send_timeout (4c follow-up). */}
      {canSendTimeout && (
      <label className="relative z-10 flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="isTimeout"
          checked={isTimeout}
          onChange={(e) => setIsTimeout(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-accent"
        />
        <span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-brand">
            <WhistleIcon className="h-4 w-4" />
            Send as TIME OUT
          </span>
          <span className="block text-xs text-subtle">
            Urgent — takes over every player&apos;s screen until they acknowledge it.
          </span>
        </span>
      </label>
      )}

      {state.error && (
        <p className="relative z-10 text-sm text-brand">{state.error}</p>
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
