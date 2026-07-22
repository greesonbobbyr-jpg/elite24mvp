"use client";

import { useActionState } from "react";
import { updateTeam, type TeamSettingsState } from "./actions";
import { TeamBrandingFields } from "@/app/components/TeamBrandingFields";
import { PhotoUploadField } from "@/app/components/PhotoUploadField";

const initialState: TeamSettingsState = {};
const field =
  "w-full rounded-lg border border-red-600/25 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-zinc-500 outline-none transition focus:border-red-500";
const label = "mb-1 block text-xs font-medium text-zinc-400";

const REMINDER_HOURS = [15, 16, 17, 18, 19, 20]; // 3 PM – 8 PM team-local

function hourLabel(h: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${ampm}`;
}

export function TeamSettingsForm({
  team,
  coachPhotoUrl,
}: {
  team: {
    name: string;
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    checkInReminderHour: number | null;
  };
  coachPhotoUrl: string | null;
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
      <div className="border-t border-white/10 pt-4">
        <label htmlFor="reminderHour" className={label}>
          Daily check-in reminder{" "}
          <span className="text-zinc-600">(players who opted in, team time)</span>
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
      <div className="border-t border-white/10 pt-4">
        <PhotoUploadField defaultPhotoUrl={coachPhotoUrl} />
      </div>

      {state.error && <p className="text-sm text-red-500">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-400">Saved.</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 self-start rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-500 active:scale-95 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
