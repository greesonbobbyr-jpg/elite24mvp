"use client";

import { useEffect, useState } from "react";
import { speaker } from "@/lib/speech";

// The daily Mindset "story of the day" on the check-in page. Starts COLLAPSED,
// showing only "1-Minute Mindset" + the title — deliberately NOT the player or
// the story, so who it's about stays a surprise. Tapping it expands to reveal
// the story (read) plus a placeholder "Listen" button. The button depends only
// on the `speaker` abstraction (lib/speech.ts) — swap that to change the voice.
export function MindsetCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [supported, setSupported] = useState(false);

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

  // --- Collapsed teaser: title only, no spoilers ---
  if (!expanded) {
    return (
      <section className="rounded-xl border border-red-600/40 bg-red-950/10">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          className="flex w-full items-center justify-between gap-3 p-5 text-left"
        >
          <span>
            <span className="text-xs font-semibold uppercase tracking-wide text-red-500">
              1-Minute Mindset
            </span>
            <span className="mt-1 block text-xl font-bold text-white">
              {title}
            </span>
            <span className="mt-1 block text-xs text-zinc-500">
              Tap to read or listen
            </span>
          </span>
          <span className="shrink-0 text-lg text-zinc-500" aria-hidden>
            ▸
          </span>
        </button>
      </section>
    );
  }

  // --- Expanded: full story + read/listen ---
  return (
    <section className="rounded-xl border border-red-600/40 bg-red-950/10 p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-red-500">
          1-Minute Mindset
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {supported ? (
            <button
              type="button"
              onClick={listen}
              aria-pressed={playing}
              className="flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              {playing ? "■ Stop" : "▶ Listen"}
            </button>
          ) : (
            <span className="text-[10px] text-zinc-500">
              Listen unavailable in this browser
            </span>
          )}
          <button
            type="button"
            onClick={collapse}
            aria-label="Collapse"
            className="rounded-full px-1.5 py-1 text-sm text-zinc-500 hover:text-zinc-300"
          >
            ▴
          </button>
        </div>
      </div>

      <h2 className="mt-3 text-xl font-bold text-white">{title}</h2>

      <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-200">
        {body}
      </p>
    </section>
  );
}
