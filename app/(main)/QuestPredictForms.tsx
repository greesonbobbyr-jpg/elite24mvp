"use client";

import { useRef, useState } from "react";
import { startQuest, completeQuest } from "./actions";
import { celebrate } from "./celebrate";

// The two client steps of a MEASURABLE quest (Quest.targetCount != null):
//   1. PredictStartForm — "how many out of N?" BEFORE the work (status PENDING).
//   2. LogActualForm — the real count after (status APPROVED + points).
// The predicted-vs-actual gap is the point: calibration trains self-assessment.

const numClass =
  "w-16 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-center text-sm text-white outline-none transition focus:border-red-500";

export function PredictStartForm({
  questId,
  targetCount,
}: {
  questId: number;
  targetCount: number;
}) {
  const [value, setValue] = useState("");
  return (
    <form action={startQuest} className="flex shrink-0 flex-col items-end gap-1">
      <input type="hidden" name="questId" value={questId} />
      <label className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
        Predict first
      </label>
      <div className="flex items-center gap-1.5">
        <input
          name="predicted"
          inputMode="numeric"
          required
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="?"
          aria-label={`Predicted count out of ${targetCount}`}
          className={numClass}
        />
        <span className="text-xs text-zinc-500">/ {targetCount}</span>
        <button
          type="submit"
          disabled={value === ""}
          className="rounded-lg bg-gradient-to-b from-red-500 to-red-700 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white shadow-md shadow-red-900/40 transition hover:from-red-500 hover:to-red-600 active:scale-[0.97] disabled:opacity-50"
        >
          Start
        </button>
      </div>
    </form>
  );
}

export function LogActualForm({
  questId,
  targetCount,
  predicted,
  points,
}: {
  questId: number;
  targetCount: number;
  predicted: number;
  points: number;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <form action={completeQuest} className="flex shrink-0 flex-col items-end gap-1">
      <input type="hidden" name="questId" value={questId} />
      <label className="text-[10px] font-bold uppercase tracking-wide text-[#e8c766]">
        You guessed {predicted} — actual?
      </label>
      <div className="flex items-center gap-1.5">
        <input
          name="actual"
          inputMode="numeric"
          required
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="?"
          aria-label={`Actual count out of ${targetCount}`}
          className={numClass}
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
