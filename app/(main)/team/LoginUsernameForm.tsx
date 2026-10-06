"use client";

import { useActionState } from "react";
import { setMyUsername, type UsernameState } from "./actions";

const initialState: UsernameState = {};
const field =
  "w-full rounded-lg border border-field-line bg-field px-3 py-2 text-sm text-ink outline-none transition focus:border-accent-edge";

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
        <p className="text-xs text-subtle">
          Email login: <span className="break-all text-ink-mid">{email}</span>
        </p>
      )}
      <label htmlFor="username" className="text-xs font-medium text-muted">
        Username {username ? "" : <span className="text-subtle">(optional)</span>}
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
          className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent transition hover:bg-accent-hover active:scale-95 disabled:bg-raised-3 disabled:text-muted"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <p className="text-[11px] text-subtle">
        3–20 characters · letters, numbers, underscore. Log in with either one.
      </p>
      {state.error && <p className="text-sm text-brand">{state.error}</p>}
      {state.ok && <p className="text-sm text-good">Saved — you can log in with it now.</p>}
    </form>
  );
}
