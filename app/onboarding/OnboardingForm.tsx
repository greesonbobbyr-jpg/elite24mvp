"use client";

import { useActionState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";
import { HeightFields } from "@/app/components/HeightFields";
import { fieldBase, labelClass } from "@/app/components/ui/Field";

const initialState: OnboardingState = {};

// Same dark field treatment as login/signup — this is a kid's first screen and
// should read as the same product.
const inputClass = `${fieldBase} w-full px-3 py-2.5 text-sm`;

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
          Your dream <span className="text-brand">★</span>
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
          <p className="mt-1 text-sm text-brand">{state.error}</p>
        )}
      </div>

      {/* Basics — all optional */}
      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
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
        <HeightFields inputClass={inputClass} labelClass={labelClass} />
      </fieldset>

      {/* Favorites — optional */}
      <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
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
        className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent transition hover:bg-accent-hover active:scale-[0.99] disabled:bg-raised-3 disabled:text-muted"
      >
        {pending ? "Saving…" : "Let's go"}
      </button>
    </form>
  );
}
