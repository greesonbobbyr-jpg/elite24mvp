"use client";

import { useActionState, useState } from "react";
import { startSeason, type SeasonState } from "./actions";
import { Button } from "@/app/components/ui/Button";
import { bannerClass } from "@/app/components/ui/Banner";

const initial: SeasonState = {};

// Org-admin-only (create_season): roll the organization into a new season.
// Staff carry over automatically; players re-join with the team code — their
// journals, streaks, and career points stay with them. Two-tap confirm.
export function StartSeasonForm({ currentSeason }: { currentSeason: string }) {
  const [state, formAction, pending] = useActionState(startSeason, initial);
  const [confirming, setConfirming] = useState(false);

  if (state.ok) {
    return (
      <p className={bannerClass("good")}>
        Season {state.seasonName} started. Players re-join with the team code.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-4 shadow-sm shadow-shade">
      <p className="text-sm text-muted">
        Current season: <span className="font-semibold text-ink">{currentSeason}</span>
      </p>
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-2 rounded-full border border-line-strong px-3 py-1 text-xs font-semibold text-ink-mid transition hover:border-field-line active:scale-95"
        >
          Start a new season…
        </button>
      ) : (
        <form action={formAction} className="mt-3 flex flex-col gap-2">
          <p className="text-xs text-subtle">
            Coaches and staff carry over; players re-join with the team code.
            Leaderboards start fresh — journals, streaks, and career points
            stay with each player.
          </p>
          <div className="flex gap-2">
            <input
              name="seasonName"
              placeholder="e.g. 2027"
              className="w-28 rounded-lg border border-field-line bg-field px-3 py-2 text-sm text-ink outline-none transition focus:border-accent-edge"
            />
            <Button type="submit" disabled={pending} size="sm">
              {pending ? "Starting…" : "Start season"}
            </Button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-xs font-semibold text-subtle hover:text-ink-mid"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {state.error && <p className="mt-2 text-sm text-brand">{state.error}</p>}
    </div>
  );
}
