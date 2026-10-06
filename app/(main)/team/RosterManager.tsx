"use client";

import { useActionState, useState } from "react";
import {
  removePlayer,
  resetPlayerPassword,
  type RosterActionState,
} from "./actions";
import { bannerClass } from "@/app/components/ui/Banner";

const initial: RosterActionState = {};

type RosterPlayer = {
  id: number;
  name: string;
  username: string | null;
};

// Staff roster management (4e): remove a player (ENDS their membership — the
// two-tap confirm says exactly what that means; nothing is deleted) and reset
// a player's password (temp value shown ONCE). Controls render only for roles
// that hold them; the server re-enforces the matrix regardless.
export function RosterManager({
  players,
  canRemove = true,
  canResetPassword = true,
}: {
  players: RosterPlayer[];
  canRemove?: boolean;
  canResetPassword?: boolean;
}) {
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
      <p className="text-sm text-subtle">
        No players yet — share your join code above.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* One-time temp password reveal */}
      {resetState.resetPassword && (
        <div className={bannerClass("good")}>
          <p className="font-semibold text-good-2">
            New password for {resetState.resetName}:
            <code className="ml-2 rounded bg-field px-2 py-0.5 font-mono text-ink">
              {resetState.resetPassword}
            </code>
          </p>
          <p className="mt-1 text-xs text-good/70">
            Shown once — write it down and hand it to them now.
          </p>
        </div>
      )}
      {(removeState.error || resetState.error) && (
        <p className="text-sm text-brand">
          {removeState.error ?? resetState.error}
        </p>
      )}

      <ul className="flex flex-col gap-1.5">
        {players.map((p) => {
          const confirming = confirmingId === p.id;
          return (
            <li
              key={p.id}
              className="rounded-xl border border-line bg-panel px-3 py-2.5 shadow-sm shadow-shade"
            >
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {p.name}
                  </p>
                  {p.username && (
                    <p className="text-[11px] text-subtle">Login: {p.username}</p>
                  )}
                </div>
                {canResetPassword && (
                  <form action={resetAction} className="shrink-0">
                    <input type="hidden" name="playerId" value={p.id} />
                    <button
                      type="submit"
                      disabled={resetting}
                      className="rounded-full border border-line-strong px-3 py-1 text-xs font-semibold text-ink-mid transition hover:border-field-line active:scale-95 disabled:opacity-60"
                    >
                      Reset password
                    </button>
                  </form>
                )}
                {canRemove && (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(confirming ? null : p.id)}
                    className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-semibold text-brand-2 transition hover:border-accent-edge active:scale-95"
                  >
                    {confirming ? "Cancel" : "Remove"}
                  </button>
                )}
              </div>

              {confirming && (
                <div className="mt-2 rounded-lg border border-line border-l-4 border-l-accent bg-sunken p-3">
                  <p className="text-xs text-ink-mid">
                    This removes {p.name.split(" ")[0]} from the roster and
                    leaderboards. Their account, journal, streak, and career
                    points are kept — they can re-join anytime with the team
                    code.
                  </p>
                  <form action={removeAction} className="mt-2">
                    <input type="hidden" name="playerId" value={p.id} />
                    <button
                      type="submit"
                      disabled={removing}
                      className="rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-on-accent transition hover:bg-accent-hover active:scale-95 disabled:bg-raised-3 disabled:text-muted"
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
