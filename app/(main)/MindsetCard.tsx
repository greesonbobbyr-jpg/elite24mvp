"use client";

import { useActionState, useEffect, useState } from "react";
import { speaker } from "@/lib/speech";
import { saveMindsetTakeaway, type TakeawayState } from "./actions";
import { Button } from "@/app/components/ui/Button";
import { cardAccent } from "@/app/components/ui/Card";

const initialTakeaway: TakeawayState = {};

// The daily Mindset "story of the day" on the check-in page. Starts COLLAPSED,
// showing only "1-Minute Mindset" + the title — deliberately NOT the player or
// the story, so who it's about stays a surprise. Tapping it expands to reveal
// the story (read) plus a placeholder "Listen" button and the required takeaway
// field (the precondition that unlocks today's check-in). The Listen button
// depends only on the `speaker` abstraction (lib/speech.ts).
export function MindsetCard({
  title,
  body,
  savedTakeaway = "",
}: {
  title: string;
  body: string;
  savedTakeaway?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [supported, setSupported] = useState(false);
  const [takeaway, setTakeaway] = useState(savedTakeaway);
  const [state, saveAction, saving] = useActionState(
    saveMindsetTakeaway,
    initialTakeaway,
  );

  // Check support on the client only (no window access during SSR), and make
  // sure speech is stopped if the player navigates away mid-story.
  useEffect(() => {
    setSupported(speaker.isSupported());
    return () => speaker.cancel();
  }, []);

  function listen() {
    if (playing) {
      speaker.cancel();
      setPlaying(false);
      return;
    }
    speaker.speak(`${title}. ${body}`, {
      onStart: () => setPlaying(true),
      onEnd: () => setPlaying(false),
      onError: () => setPlaying(false),
    });
  }

  function collapse() {
    speaker.cancel();
    setPlaying(false);
    setExpanded(false);
  }

  // --- Collapsed teaser: slim one-line strip (title only, no spoilers) ---
  if (!expanded) {
    return (
      <section className="rounded-xl border border-red-600/40 bg-gradient-to-r from-red-950/25 to-zinc-950/40 transition hover:-translate-y-0.5 hover:border-red-500/60 active:scale-[0.99]">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          className="group flex w-full items-center gap-3 px-4 py-3 text-left"
        >
          <span aria-hidden className="shrink-0 text-base">
            🏀
          </span>
          <span className="e24-eyebrow shrink-0">1-Minute Mindset</span>
          <span className="min-w-0 flex-1 truncate font-semibold text-white">
            {title}
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

  // --- Expanded: full story + read/listen ---
  return (
    <section className={`${cardAccent} e24-reveal`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-red-500">
          1-Minute Mindset
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {supported ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={listen}
              aria-pressed={playing}
            >
              {playing ? "■ Stop" : "▶ Listen"}
            </Button>
          ) : (
            <span className="text-[10px] text-zinc-500">
              Listen unavailable in this browser
            </span>
          )}
          <button
            type="button"
            onClick={collapse}
            aria-label="Collapse"
            className="rounded-full px-1.5 py-1 text-sm text-zinc-500 transition hover:text-zinc-300 active:scale-95"
          >
            ▴
          </button>
        </div>
      </div>

      <h2 className="mt-3 text-xl font-bold text-white">{title}</h2>

      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-200">
        {body}
      </p>

      {/* Required takeaway — the precondition that unlocks today's check-in. */}
      <form action={saveAction} className="mt-4 border-t border-white/10 pt-4">
        <label htmlFor="mindset-takeaway" className="e24-eyebrow">
          What&apos;d you take from this?
        </label>
        <textarea
          id="mindset-takeaway"
          name="text"
          required
          rows={2}
          value={takeaway}
          onChange={(e) => setTakeaway(e.target.value)}
          placeholder="A few words on what stuck with you…"
          className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/40"
        />
        {state.error && <p className="mt-1 text-sm text-red-500">{state.error}</p>}
        <div className="mt-2 flex items-center gap-3">
          <Button type="submit" size="sm" disabled={saving}>
            {saving
              ? "Saving…"
              : savedTakeaway || state.ok
                ? "Update takeaway"
                : "Save takeaway"}
          </Button>
          {(state.ok || (savedTakeaway !== "" && !state.error)) && (
            <span className="text-xs font-medium text-green-400">✓ Saved</span>
          )}
        </div>
      </form>
    </section>
  );
}
