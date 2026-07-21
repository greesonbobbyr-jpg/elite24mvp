"use client";

import { useActionState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";

const initialState: OnboardingState = {};

// Same dark field treatment as login/signup — this is a kid's first screen and
// should read as the same product.
const inputClass =
  "w-full rounded-lg border border-red-600/25 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-red-500";
const labelClass = "mb-1 block text-xs font-medium text-zinc-400";

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(
    completeOnboarding,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {/* The Dream — required */}
      <div>
        <label htmlFor="dream" className={labelClass}>
          Your dream <span className="text-red-600">★</span>
        </label>
        <textarea
          id="dream"
          name="dream"
          required
          rows={3}
          placeholder="Where do you want basketball to take you?"
          className={inputClass}
        />
        {state.error && (
          <p className="mt-1 text-sm text-red-600">{state.error}</p>
        )}
      </div>

      {/* Basics — all optional */}
      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          The basics
        </legend>
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor="position" className={labelClass}>
            Position
          </label>
          <input
            id="position"
            name="position"
            placeholder="Guard"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="jerseyNumber" className={labelClass}>
            Jersey #
          </label>
          <input
            id="jerseyNumber"
            name="jerseyNumber"
            type="number"
            min={0}
            placeholder="23"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="heightInches" className={labelClass}>
            Height (in)
          </label>
          <input
            id="heightInches"
            name="heightInches"
            type="number"
            min={0}
            placeholder="68"
            className={inputClass}
          />
        </div>
      </fieldset>

      {/* Favorites — optional */}
      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Favorites
        </legend>
        <div>
          <label htmlFor="favoritePlayer" className={labelClass}>
            Favorite player
          </label>
          <input
            id="favoritePlayer"
            name="favoritePlayer"
            placeholder="Stephen Curry"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="favoriteTeam" className={labelClass}>
            Favorite team
          </label>
          <input
            id="favoriteTeam"
            name="favoriteTeam"
            placeholder="Golden State Warriors"
            className={inputClass}
          />
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? "Saving…" : "Let's go"}
      </button>
    </form>
  );
}
