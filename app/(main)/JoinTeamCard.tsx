"use client";

import { useActionState } from "react";
import { joinTeamWithCode, type JoinTeamState } from "@/app/join/actions";
import { Button } from "@/app/components/ui/Button";

const initial: JoinTeamState = {};

// Shown on Home to a player with NO active membership (removed from a roster,
// or the season rolled over). Their daily loop keeps working (offseason —
// career points, streaks, journal); this card gets them onto a roster: enter
// the team code, membership lands on their EXISTING profile, history carries.
export function JoinTeamCard() {
  const [state, formAction, pending] = useActionState(joinTeamWithCode, initial);

  return (
    <section className="e24-surface rounded-2xl border border-red-600/30 p-5">
      <div className="relative z-10">
        <p className="e24-eyebrow">Join your team</p>
        <p className="mt-1 text-sm text-zinc-400">
          You&apos;re not on a team roster this season. Your journal, streak, and
          career points are safe — enter your coach&apos;s team code to join.
        </p>
        {state.ok ? (
          <p className="mt-3 text-sm font-semibold text-green-400">
            Welcome to {state.teamName}! Loading your team…
          </p>
        ) : (
          <form action={formAction} className="mt-3 flex gap-2">
            <input
              name="code"
              placeholder="TEAM CODE"
              autoCapitalize="characters"
              className="w-36 rounded-lg border border-red-600/25 bg-black/40 px-3 py-2 text-sm font-mono uppercase tracking-widest text-white placeholder:text-zinc-600 outline-none transition focus:border-red-500"
            />
            <Button type="submit" disabled={pending} size="sm">
              {pending ? "Joining…" : "Join"}
            </Button>
          </form>
        )}
        {state.error && (
          <p className="mt-2 text-sm text-red-500">{state.error}</p>
        )}
      </div>
    </section>
  );
}
