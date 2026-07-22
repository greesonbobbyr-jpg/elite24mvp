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
      <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
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
          className="w-16 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-center text-sm text-white outline-none transition focus:border-red-500"
        />
        <span className="text-xs text-zinc-500">/ {targetCount}</span>
        <button
          ref={ref}
          type="submit"
          disabled={value === ""}
          onClick={() => value !== "" && celebrate(ref.current, points)}
          className="rounded-lg bg-gradient-to-b from-red-500 to-red-700 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-md shadow-red-900/40 transition hover:from-red-500 hover:to-red-600 active:scale-[0.97] disabled:opacity-50"
        >
          Done +{points}
        </button>
      </div>
    </form>
  );
}
