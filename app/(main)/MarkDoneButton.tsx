"use client";

import { useRef } from "react";
import { logQuest } from "./actions";
import { celebrate } from "./celebrate";

// The "Mark done" action for a not-yet-completed quest. Identical form/submit to
// before (server action logQuest, hidden questId) — the ONLY addition is the
// onClick that fires the "Tile Pop" celebration. Because it's tied to the tap, it
// never runs on page load or on undo. onClick does NOT preventDefault, so the
// form still submits to logQuest exactly as before.
export function MarkDoneButton({
  questId,
  points,
}: {
  questId: number;
  points: number;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <form action={logQuest} className="shrink-0">
      <input type="hidden" name="questId" value={questId} />
      <button
        ref={ref}
        type="submit"
        onClick={() => celebrate(ref.current, points)}
        className="flex h-12 w-24 flex-col items-center justify-center rounded-xl bg-gradient-to-b from-red-500 to-red-700 text-white shadow-md shadow-red-900/40 transition hover:from-red-500 hover:to-red-600 active:scale-[0.97]"
      >
        <span className="text-xs font-bold uppercase tracking-wide leading-none">
          Mark done
        </span>
        <span className="mt-0.5 text-[11px] font-semibold leading-none">
          +{points}
        </span>
      </button>
    </form>
  );
}
