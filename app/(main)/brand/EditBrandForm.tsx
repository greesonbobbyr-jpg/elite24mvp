"use client";

import { useActionState } from "react";
import { updateBrand, type BrandState } from "./actions";
import { Button } from "@/app/components/ui/Button";
import { cardDefault } from "@/app/components/ui/Card";
import { PhotoUploadField } from "@/app/components/PhotoUploadField";
import { HeightFields } from "@/app/components/HeightFields";
import { fieldClass, labelClass } from "@/app/components/ui/Field";

const initialState: BrandState = {};

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
  photoUrl: string | null;
  photoCutoutUrl: string | null;
  photoMeta: unknown;
};

export function EditBrandForm({ profile }: { profile: EditableProfile }) {
  const [state, formAction, pending] = useActionState(
    updateBrand,
    initialState,
  );

  return (
    <details className={cardDefault}>
      <summary className="cursor-pointer select-none text-sm font-semibold text-brand">
        Edit my brand
      </summary>
      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <PhotoUploadField
          defaultPhotoUrl={profile.photoUrl}
          defaultCutoutUrl={profile.photoCutoutUrl}
          defaultMeta={profile.photoMeta ? JSON.stringify(profile.photoMeta) : null}
        />

        <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <label className={labelClass}>Position</label>
            <input name="position" defaultValue={profile.position ?? ""} className={fieldClass} />
          </div>
          <div>
            <label className={labelClass}>Jersey #</label>
            <input name="jerseyNumber" type="number" min={0} defaultValue={profile.jerseyNumber ?? ""} className={fieldClass} />
          </div>
          <HeightFields
            defaultInches={profile.heightInches}
            inputClass={fieldClass}
            labelClass={labelClass}
          />
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

        {state.error && <p className="text-sm text-brand">{state.error}</p>}

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Saving…" : "Save"}
        </Button>
      </form>
    </details>
  );
}
