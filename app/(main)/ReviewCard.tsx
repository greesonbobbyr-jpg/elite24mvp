"use client";

import { useActionState, useState } from "react";
import { submitReview, type ReviewState } from "./actions";
import { Button } from "@/app/components/ui/Button";

const initialState: ReviewState = {};

type SavedReview = {
  outcome: "YES" | "PARTIAL" | "NO";
  learned: string;
  noteToTomorrow: string | null;
} | null;

const OUTCOMES = [
  { value: "YES", label: "Yes ✔" },
  { value: "PARTIAL", label: "Partly" },
  { value: "NO", label: "Not today" },
] as const;

const OUTCOME_LABEL: Record<string, string> = {
  YES: "Plan → done ✔",
  PARTIAL: "Got part of it done",
  NO: "Didn't get to it",
};

// The evening "Pro Review" — closes the E24P cycle (Plan → Preview → Perform →
// REVIEW). Shows the morning plan and today's logged quests side by side (plan
// vs action), asks how it went + what the player noticed, and captures one line
// for tomorrow-you (which resurfaces in tomorrow's check-in). Private like the
// journal — the coach only ever sees that it was done.
export function ReviewCard({
  reflection,
  loggedQuests,
  savedReview,
}: {
  reflection: string;
  loggedQuests: { title: string; points: number }[];
  savedReview: SavedReview;
}) {
  const [state, formAction, pending] = useActionState(submitReview, initialState);
  const [outcome, setOutcome] = useState<string>("");
  // Collapsed by default: after checking in, the player's NEXT step is the
  // 1-Minute Mindset — the review is an end-of-day thing, so it waits as a
  // quiet strip until tapped (sits BELOW the Mindset on the page).
  const [expanded, setExpanded] = useState(false);

  // Already reviewed — show the closed loop, not a form.
  if (savedReview) {
    return (
      <section className="rounded-xl border border-red-600/40 bg-red-950/10 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="e24-eyebrow">Pro Review</h2>
          <span className="rounded-full bg-green-600/15 px-2.5 py-0.5 text-xs font-semibold text-green-400">
            ✓ Done · +5
          </span>
        </div>
        <p className="mt-2 text-sm font-semibold text-white">
          {OUTCOME_LABEL[savedReview.outcome]}
        </p>
        <p className="mt-1.5 whitespace-pre-wrap text-sm text-zinc-300">
          {savedReview.learned}
        </p>
        {savedReview.noteToTomorrow && (
          <p className="mt-2 text-xs text-zinc-500">
            For tomorrow-you: “{savedReview.noteToTomorrow}”
          </p>
        )}
      </section>
    );
  }

  // Collapsed teaser — mirrors the Mindset strip so it reads as "later", not
  // "next". Tapping expands the full review form.
  if (!expanded) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 transition hover:border-red-500/40">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          className="group flex w-full items-center gap-3 px-4 py-3 text-left"
        >
          <span aria-hidden className="shrink-0 text-base">
            🌙
          </span>
          <span className="e24-eyebrow shrink-0">Pro Review</span>
          <span className="min-w-0 flex-1 truncate text-sm text-zinc-500">
            End your day — how did the plan go? · +5
          </span>
          <span
            className="shrink-0 text-lg text-red-500/70 transition-transform group-hover:rotate-90"
            aria-hidden
          >
            ▸
          </span>
        </button>
      </section>
    );
  }

  return (
    <section className="e24-reveal rounded-xl border border-red-600/40 bg-red-950/10 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="e24-eyebrow">Pro Review</h2>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Collapse"
          className="rounded-full px-1.5 py-1 text-sm text-zinc-500 transition hover:text-zinc-300 active:scale-95"
        >
          ▴
        </button>
      </div>
      <p className="mt-1 text-lg font-semibold text-white">
        How did today&apos;s plan go?
      </p>

      {/* Plan vs action, side by side. */}
      <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
          You said
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">
          {reflection}
        </p>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
          You logged
        </p>
        {loggedQuests.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-500">No quests logged yet.</p>
        ) : (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {loggedQuests.map((q) => (
              <span
                key={q.title}
                className="rounded-full bg-[#d4af37]/15 px-2.5 py-0.5 text-xs font-semibold text-[#e8c766]"
              >
                {q.title} +{q.points}
              </span>
            ))}
          </div>
        )}
      </div>

      <form action={formAction} className="mt-4 flex flex-col gap-3">
        <input type="hidden" name="outcome" value={outcome} />
        <div className="flex gap-2">
          {OUTCOMES.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setOutcome(o.value)}
              className={`flex-1 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wide transition active:scale-95 ${
                outcome === o.value
                  ? "border-red-500 bg-red-600/20 text-red-300"
                  : "border-white/15 text-zinc-400 hover:border-white/30"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="review-learned" className="e24-eyebrow">
            What did you notice?
          </label>
          <textarea
            id="review-learned"
            name="learned"
            required
            rows={2}
            placeholder="One honest thing about today's work…"
            className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/40"
          />
        </div>

        <div>
          <label htmlFor="review-note" className="e24-eyebrow">
            One line for tomorrow-you <span className="normal-case text-zinc-600">(optional)</span>
          </label>
          <input
            id="review-note"
            name="noteToTomorrow"
            placeholder="It shows up in tomorrow's check-in."
            className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/40"
          />
        </div>

        {state.error && <p className="text-sm text-red-500">{state.error}</p>}

        <Button type="submit" size="sm" disabled={pending || !outcome} className="self-start">
          {pending ? "Saving…" : "Finish the day · +5"}
        </Button>
      </form>
    </section>
  );
}
