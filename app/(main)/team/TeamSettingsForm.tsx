"use client";

import { useActionState } from "react";
import { updateTeam, type TeamSettingsState } from "./actions";
import { TeamBrandingFields } from "@/app/components/TeamBrandingFields";
import { PhotoUploadField } from "@/app/components/PhotoUploadField";

const initialState: TeamSettingsState = {};
const field =
  "w-full rounded-lg border border-field-line bg-field px-3 py-2 text-sm text-ink outline-none transition focus:border-accent-edge";
const label = "mb-1 block text-xs font-medium text-muted";

// Any hour of the day, team-local (owner note: coaches set it at whatever time
// they want). The server accepts 0–23; minute-level times are a later step.
const REMINDER_HOURS = Array.from({ length: 24 }, (_, h) => h);

function hourLabel(h: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${ampm}`;
}

export function TeamSettingsForm({
  team,
  coachPhotoUrl,
  coachCutoutUrl = null,
  coachPhotoMeta = null,
}: {
  team: {
    name: string;
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    checkInReminderHour: number | null;
  };
  coachPhotoUrl: string | null;
  coachCutoutUrl?: string | null;
  coachPhotoMeta?: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateTeam, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="name" className={label}>Team name</label>
        <input id="name" name="name" required defaultValue={team.name} className={field} />
      </div>
      <TeamBrandingFields
        defaultLogoUrl={team.logoUrl}
        defaultPrimary={team.primaryColor}
        defaultSecondary={team.secondaryColor}
      />

      {/* Daily check-in reminder (Web Push) — the coach controls the trigger.
          Players opt in on their Notifications page; nothing sends without both. */}
      <div className="border-t border-line pt-4">
        <label htmlFor="reminderHour" className={label}>
          Daily check-in reminder{" "}
          <span className="text-subtle">(players who opted in, team time)</span>
        </label>
        <select
          id="reminderHour"
          name="reminderHour"
          defaultValue={team.checkInReminderHour ?? ""}
          className={field}
        >
          <option value="">Off</option>
          {REMINDER_HOURS.map((h) => (
            <option key={h} value={h}>
              {hourLabel(h)}
            </option>
          ))}
        </select>
      </div>

      {/* The coach's OWN photo (shows in their header identity chip). */}
      <div className="border-t border-line pt-4">
        <PhotoUploadField
          defaultPhotoUrl={coachPhotoUrl}
          defaultCutoutUrl={coachCutoutUrl}
          defaultMeta={coachPhotoMeta}
        />
      </div>

      {state.error && <p className="text-sm text-brand">{state.error}</p>}
      {state.ok && <p className="text-sm text-good">Saved.</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 self-start rounded-full bg-accent px-5 py-2 text-sm font-semibold text-on-accent transition hover:bg-accent-hover active:scale-95 disabled:bg-raised-3 disabled:text-muted"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
