"use client";

import { useRef, useState } from "react";
import { completeQuest } from "./actions";
import { celebrate } from "./celebrate";

// One-step completion for a MEASURABLE quest (Quest.targetCount != null): the
// player enters how many they made and taps Done — count recorded on the log,
// points awarded, "made X / N" shown on the tile.

export function QuestCountForm({
  questId,
  targetCount,
  points,
}: {
  questId: number;
  targetCount: number;
  points: number;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <form action={completeQuest} className="flex shrink-0 flex-col items-end gap-1">
      <input type="hidden" name="questId" value={questId} />
      <label className="text-[10px] font-bold uppercase tracking-wide text-subtle">
        How many made?
      </label>
      <div className="flex items-center gap-1.5">
        <input
          name="actual"
          inputMode="numeric"
          required
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="?"
          aria-label={`How many made out of ${targetCount}`}
          className="w-16 rounded-lg border border-line-strong bg-raised px-2 py-1.5 text-center text-sm text-ink outline-none transition focus:border-accent-edge"
        />
        <span className="text-xs text-subtle">/ {targetCount}</span>
        <button
          ref={ref}
          type="submit"
          disabled={value === ""}
          onClick={() => value !== "" && celebrate(ref.current, points)}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-on-accent shadow-md shadow-shade transition hover:bg-accent-hover active:scale-[0.97] disabled:bg-raised-3 disabled:text-muted disabled:shadow-none"
        >
          Done +{points}
        </button>
      </div>
    </form>
  );
}
