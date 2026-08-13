"use client";

import { useMemo, useState } from "react";
import type { SearchEntry } from "@/lib/orgview";
import type { Focus } from "./OrgExplorer";

const KIND_LABEL: Record<SearchEntry["kind"], string> = {
  program: "Program",
  division: "Division",
  team: "Team",
  staff: "Staff",
  player: "Player",
};

// Org-scoped search, pinned at the top on both platforms. Filters the
// server-built index client-side (orgs are small) and jumps focus straight to
// the match — people additionally get a highlight ring at their card.
export function SearchBar({
  index,
  navigate,
}: {
  index: SearchEntry[];
  navigate: (focus: Focus) => void;
}) {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return index
      .filter((e) => e.name.toLowerCase().includes(needle))
      .slice(0, 12);
  }, [q, index]);

  function jump(e: SearchEntry) {
    navigate({
      p: e.path.programId ?? null,
      d: e.path.divisionId ?? null,
      t: e.path.teamId ?? null,
      hl: e.userId ?? null,
    });
    setQ("");
  }

  return (
    <div className="sticky top-0 z-30 -mx-1 bg-black/85 px-1 py-2 backdrop-blur-sm">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search players, coaches, teams, divisions…"
        className="w-full rounded-xl border border-red-600/25 bg-black/60 px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-red-500"
      />
      {results.length > 0 && (
        <ul className="absolute inset-x-1 top-full z-40 mt-1 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
          {results.map((e) => (
            <li key={`${e.kind}-${e.id}`}>
              <button
                type="button"
                onClick={() => jump(e)}
                className="flex w-full items-baseline gap-2 px-4 py-2 text-left transition hover:bg-white/5"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                  {e.name}
                </span>
                {e.detail && (
                  <span className="truncate text-xs text-zinc-500">{e.detail}</span>
                )}
                <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-zinc-400">
                  {KIND_LABEL[e.kind]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
