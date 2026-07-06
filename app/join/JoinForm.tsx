"use client";

import { useActionState } from "react";
import {
  lookupJoinCode,
  createPlayer,
  type LookupState,
  type CreatePlayerState,
} from "./actions";

const field =
  "w-full rounded-lg border border-red-600/25 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-red-500";
const label = "mb-1 block text-xs font-medium text-zinc-400";
const button =
  "mt-1 w-full rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 active:scale-[0.99] disabled:opacity-60";

// Two-phase: enter code (server-validated → shows the team name), then create a
// username+password player account on that team. The validated code is carried
// into phase 2 as a hidden field and re-checked server-side before any write.
export function JoinForm() {
  const [lookup, lookupAction, lookingUp] = useActionState(
    lookupJoinCode,
    {} as LookupState,
  );

  const confirmed = Boolean(lookup.code && lookup.teamName);
  if (confirmed) {
    return <PlayerAccountForm code={lookup.code!} teamName={lookup.teamName!} />;
  }

  return (
    <form action={lookupAction} className="flex flex-col gap-3">
      <div>
        <label htmlFor="code" className={label}>
          Team code
        </label>
        <input
          id="code"
          name="code"
          required
          autoComplete="off"
          autoCapitalize="characters"
          className={`${field} text-center text-lg font-semibold uppercase tracking-[0.35em]`}
        />
        <p className="mt-1 text-[11px] text-zinc-500">
          Ask your coach for your team&apos;s join code.
        </p>
      </div>

      {lookup.error && <p className="text-sm text-red-500">{lookup.error}</p>}

      <button type="submit" disabled={lookingUp} className={button}>
        {lookingUp ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}

function PlayerAccountForm({
  code,
  teamName,
}: {
  code: string;
  teamName: string;
}) {
  const [state, formAction, pending] = useActionState(
    createPlayer,
    {} as CreatePlayerState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="rounded-lg border border-red-600/25 bg-black/40 px-3 py-2.5 text-sm">
        <span className="text-zinc-400">You&apos;re joining </span>
        <span className="font-semibold text-white">{teamName}</span>
      </div>
      <input type="hidden" name="code" value={code} />

      <div>
        <label htmlFor="name" className={label}>
          Your name
        </label>
        <input id="name" name="name" required className={field} />
      </div>
      <div>
        <label htmlFor="username" className={label}>
          Username
        </label>
        <input
          id="username"
          name="username"
          required
          autoCapitalize="none"
          autoComplete="username"
          minLength={3}
          maxLength={20}
          className={field}
        />
        <p className="mt-1 text-[11px] text-zinc-500">
          3–20 characters · letters, numbers, underscore. You&apos;ll log in with this.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="password" className={label}>
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="confirm" className={label}>
            Confirm
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className={field}
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-red-500">{state.error}</p>}

      <button type="submit" disabled={pending} className={button}>
        {pending ? "Creating your account…" : "Join team & get started"}
      </button>

      {/* Full reload resets the two-phase state cleanly. */}
      <a href="/join" className="text-center text-xs text-zinc-500 hover:underline">
        Wrong code? Start over
      </a>
    </form>
  );
}
