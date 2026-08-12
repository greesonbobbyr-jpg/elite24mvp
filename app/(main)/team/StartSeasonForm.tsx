"use client";

import { useActionState, useState } from "react";
import { startSeason, type SeasonState } from "./actions";
import { Button } from "@/app/components/ui/Button";

const initial: SeasonState = {};

// Org-admin-only (create_season): roll the organization into a new season.
// Staff carry over automatically; players re-join with the team code — their
// journals, streaks, and career points stay with them. Two-tap confirm.
export function StartSeasonForm({ currentSeason }: { currentSeason: string }) {
  const [state, formAction, pending] = useActionState(startSeason, initial);
  const [confirming, setConfirming] = useState(false);

  if (state.ok) {
    return (
      <p className="rounded-lg border border-green-600/40 bg-green-600/10 px-3 py-2.5 text-sm font-semibold text-green-300">
        Season {state.seasonName} started. Players re-join with the team code.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <p className="text-sm text-zinc-400">
        Current season: <span className="font-semibold text-white">{currentSeason}</span>
      </p>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-2 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-zinc-300 transition hover:border-white/30 active:scale-95"
        >
          Start a new season…
        </button>
      ) : (
        <form action={formAction} className="mt-3 flex flex-col gap-2">
          <p className="text-xs text-zinc-500">
            Coaches and staff carry over; players re-join with the team code.
            Leaderboards start fresh — journals, streaks, and career points
            stay with each player.
          </p>
          <div className="flex gap-2">
            <input
              name="seasonName"
              placeholder="e.g. 2027"
              className="w-28 rounded-lg border border-red-600/25 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-red-500"
            />
            <Button type="submit" disabled={pending} size="sm">
              {pending ? "Starting…" : "Start season"}
            </Button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-xs font-semibold text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {state.error && <p className="mt-2 text-sm text-red-500">{state.error}</p>}
    </div>
  );
}
