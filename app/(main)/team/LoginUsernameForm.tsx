"use client";

import { useActionState } from "react";
import { setMyUsername, type UsernameState } from "./actions";

const initialState: UsernameState = {};
const field =
  "w-full rounded-lg border border-red-600/25 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-red-500";

// The staffer's own login: their email always works; a username is optional
// and lets them log in the same way players do.
export function LoginUsernameForm({
  email,
  username,
}: {
  email: string | null;
  username: string | null;
}) {
  const [state, formAction, pending] = useActionState(setMyUsername, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {email && (
        <p className="text-xs text-zinc-500">
          Email login: <span className="break-all text-zinc-300">{email}</span>
        </p>
      )}
      <label htmlFor="username" className="text-xs font-medium text-zinc-400">
        Username {username ? "" : <span className="text-zinc-600">(optional)</span>}
      </label>
      <div className="flex gap-2">
        <input
          id="username"
          name="username"
          required
          defaultValue={username ?? ""}
          placeholder="e.g. coachgary"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          minLength={3}
          maxLength={21}
          className={field}
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 active:scale-95 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <p className="text-[11px] text-zinc-500">
        3–20 characters · letters, numbers, underscore. Log in with either one.
      </p>
      {state.error && <p className="text-sm text-red-500">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-400">Saved — you can log in with it now.</p>}
    </form>
  );
}
