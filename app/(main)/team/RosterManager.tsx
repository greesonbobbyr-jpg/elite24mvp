"use client";

import { useActionState, useState } from "react";
import {
  removePlayer,
  resetPlayerPassword,
  type RosterActionState,
} from "./actions";

const initial: RosterActionState = {};

type RosterPlayer = {
  id: number;
  name: string;
  username: string | null;
};

// Coach roster management: remove a player (HARD delete — two-tap confirm that
// says exactly what goes with them) and reset a player's password (temp value
// shown ONCE). Server actions re-enforce coach-only + own-team + player-only.
export function RosterManager({ players }: { players: RosterPlayer[] }) {
  const [removeState, removeAction, removing] = useActionState(
    removePlayer,
    initial,
  );
  const [resetState, resetAction, resetting] = useActionState(
    resetPlayerPassword,
    initial,
  );
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  if (players.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No players yet — share your join code above.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* One-time temp password reveal */}
      {resetState.resetPassword && (
        <div className="rounded-lg border border-green-600/40 bg-green-600/10 px-3 py-2.5 text-sm">
          <p className="font-semibold text-green-300">
            New password for {resetState.resetName}:
            <code className="ml-2 rounded bg-black/40 px-2 py-0.5 font-mono text-white">
              {resetState.resetPassword}
            </code>
          </p>
          <p className="mt-1 text-xs text-green-400/70">
            Shown once — write it down and hand it to them now.
          </p>
        </div>
      )}
      {(removeState.error || resetState.error) && (
        <p className="text-sm text-red-500">
          {removeState.error ?? resetState.error}
        </p>
      )}

      <ul className="flex flex-col gap-1.5">
        {players.map((p) => {
          const confirming = confirmingId === p.id;
          return (
            <li
              key={p.id}
              className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5"
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {p.name}
                  </p>
                  {p.username && (
                    <p className="text-[11px] text-zinc-500">@{p.username}</p>
                  )}
                </div>
                <form action={resetAction} className="shrink-0">
                  <input type="hidden" name="playerId" value={p.id} />
                  <button
                    type="submit"
                    disabled={resetting}
                    className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-zinc-300 transition hover:border-white/30 active:scale-95 disabled:opacity-60"
                  >
                    Reset password
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => setConfirmingId(confirming ? null : p.id)}
                  className="shrink-0 rounded-full border border-red-600/40 px-3 py-1 text-xs font-semibold text-red-400 transition hover:border-red-500 active:scale-95"
                >
                  {confirming ? "Cancel" : "Remove"}
                </button>
              </div>

              {confirming && (
                <div className="mt-2 rounded-lg border border-red-600/40 bg-red-950/20 p-3">
                  <p className="text-xs text-red-300">
                    This permanently deletes {p.name.split(" ")[0]}&apos;s
                    account — their journal, points, streak, and messages go
                    with it. For players who have left the team.
                  </p>
                  <form action={removeAction} className="mt-2">
                    <input type="hidden" name="playerId" value={p.id} />
                    <button
                      type="submit"
                      disabled={removing}
                      className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-red-500 active:scale-95 disabled:opacity-60"
                    >
                      {removing ? "Removing…" : `Yes, remove ${p.name.split(" ")[0]}`}
                    </button>
                  </form>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
