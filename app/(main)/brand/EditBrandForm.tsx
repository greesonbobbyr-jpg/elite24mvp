"use client";

import { useActionState } from "react";
import { updateBrand, type BrandState } from "./actions";
import { Button } from "@/app/components/ui/Button";
import { cardDefault } from "@/app/components/ui/Card";

const initialState: BrandState = {};
const fieldClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-red-500";
const labelClass = "mb-1 block text-xs font-medium text-zinc-400";

type EditableProfile = {
  heightInches: number | null;
  position: string | null;
  jerseyNumber: number | null;
  pointsPerGame: number | null;
  reboundsPerGame: number | null;
  assistsPerGame: number | null;
  favoritePlayer: string | null;
  favoriteTeam: string | null;
  highlightUrl: string | null;
};

export function EditBrandForm({ profile }: { profile: EditableProfile }) {
  const [state, formAction, pending] = useActionState(
    updateBrand,
    initialState,
  );

  return (
    <details className={cardDefault}>
      <summary className="cursor-pointer select-none text-sm font-semibold text-red-500">
        Edit my brand
      </summary>
      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass}>Position</label>
            <input name="position" defaultValue={profile.position ?? ""} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Jersey #</label>
            <input name="jerseyNumber" type="number" min={0} defaultValue={profile.jerseyNumber ?? ""} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Height (in)</label>
            <input name="heightInches" type="number" min={0} defaultValue={profile.heightInches ?? ""} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>PPG</label>
            <input name="pointsPerGame" type="number" step="0.1" min={0} defaultValue={profile.pointsPerGame ?? ""} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>RPG</label>
            <input name="reboundsPerGame" type="number" step="0.1" min={0} defaultValue={profile.reboundsPerGame ?? ""} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>APG</label>
            <input name="assistsPerGame" type="number" step="0.1" min={0} defaultValue={profile.assistsPerGame ?? ""} className={fieldClass} />
          </div>
        </fieldset>

        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Favorite player</label>
            <input name="favoritePlayer" defaultValue={profile.favoritePlayer ?? ""} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Favorite team</label>
            <input name="favoriteTeam" defaultValue={profile.favoriteTeam ?? ""} className={fieldClass} />
          </div>
        </fieldset>

        <div>
          <label className={labelClass}>Highlight link (paste a video URL)</label>
          <input
            name="highlightUrl"
            type="url"
            placeholder="https://youtube.com/watch?v=…"
            defaultValue={profile.highlightUrl ?? ""}
            className={fieldClass}
          />
        </div>

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>
    </details>
  );
}
