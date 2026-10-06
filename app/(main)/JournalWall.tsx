"use client";

import { useState } from "react";
import { formatDayKey } from "@/lib/format";

type Entry = { id: number; day: string; reflection: string };

// The journal "wall of days": a grid of day-tiles (newest first) with a
// client-side tap-to-open full-entry view. It renders ONLY the entries already
// fetched + passed by the (owner-only) server page — it never fetches, so no
// other user's data is reachable and there's no route/URL change.
export function JournalWall({
  entries,
  today,
}: {
  entries: Entry[];
  today: string;
}) {
  const [openId, setOpenId] = useState<number | null>(null);

  if (entries.length === 0) {
    return (
      <section className="e24-surface rounded-2xl p-6">
        <div className="relative z-10">
          <p className="e24-eyebrow">Your Journal</p>
          <p className="mt-2 text-lg font-semibold text-ink">
            Your story starts with today&apos;s check-in.
          </p>
          <p className="mt-1 text-sm text-muted">
            Every day you log becomes a tile on your wall.
          </p>
        </div>
      </section>
    );
  }

  // --- Open full entry ---
  const open = openId != null ? entries.find((e) => e.id === openId) : null;
  if (open) {
    return (
      <section className="e24-reveal e24-surface rounded-2xl p-6">
        <div className="relative z-10">
          <button
            type="button"
            onClick={() => setOpenId(null)}
            className="text-sm font-medium text-brand transition hover:text-brand-2 active:scale-95"
          >
            ← Back to all days
          </button>
          <h2 className="mt-4 text-xl font-bold text-ink">
            {formatDayKey(open.day)}
          </h2>
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">
            {open.reflection}
          </p>
        </div>
      </section>
    );
  }

  // --- Grid of day-tiles ---
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {entries.map((entry) => {
        const isToday = entry.day === today;
        return (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => setOpenId(entry.id)}
              className={`e24-surface flex h-full w-full flex-col rounded-2xl p-3.5 text-left transition hover:-translate-y-0.5 active:scale-[0.98] ${
                isToday ? "border-2 border-accent-edge" : ""
              }`}
            >
              <span className="relative z-10 flex items-center justify-between gap-2">
                <span className="e24-eyebrow truncate">
                  {formatDayKey(entry.day)}
                </span>
                {isToday && (
                  <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-on-accent">
                    Today
                  </span>
                )}
              </span>
              <span className="relative z-10 mt-2 line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-ink-mid">
                {entry.reflection}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
