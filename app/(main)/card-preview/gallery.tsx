"use client";

import { useState, type ReactNode } from "react";
import { PlayerCard, type CardPlayer, type CardTeam } from "@/app/components/PlayerCard";
import { FINISH_ORDER, FINISHES, type FinishKey } from "@/lib/cardTheme";
import { PortraitDebug } from "./PortraitDebug";

// CARD-PREVIEW GALLERY (Stage 2) — the 9 dev environments of the card system
// (§45): the five player finishes with IDENTICAL sample data, plus the four
// staff roles. Dev-only (the page gates on NODE_ENV); nothing here ships.
//
// REFERENCE OVERLAY MODE (§46, required): any image dropped into
// design/reference/ can be rendered absolutely over a card at exactly the
// card's dimensions with an opacity slider — the primary correction
// instrument of the visual loop. Human visual approval is the acceptance
// authority (Δ14); this tool exists to inform that judgment.

// §45/§55 sample identity — dev-only, never in production assets.
const SAMPLE_PLAYER: CardPlayer = {
  name: "Cason Wallace",
  jerseyNumber: 22,
  position: "COMBO GUARD",
  heightInches: 76, // 6'4"
  points: 525,
  total: 525,
  rank: 1,
  rosterSize: 7,
};

const SAMPLE_TEAM: CardTeam = {
  name: "Mustang Broncos",
  logoUrl: "/mustang-logo.png",
  primaryColor: "#c9223a",
  secondaryColor: "#f2a900",
};

// Dev-only sample staff (Stage 8 renders real StaffCards here).
const SAMPLE_STAFF: { shot: string; name: string; role: string }[] = [
  { shot: "staff-hc", name: "Darnell Brooks", role: "Head Coach" },
  { shot: "staff-ac", name: "Maya Ortiz", role: "Assistant Coach" },
  { shot: "staff-gm", name: "Terrence Cole", role: "General Manager" },
  { shot: "staff-owner", name: "Angela Whitfield", role: "Organization Owner" },
];

const OPACITY_STOPS = [0, 25, 50, 75, 100];

/** Best default reference file for a card kind, if present. */
function defaultRef(refs: string[], kind: "player" | "staff"): string | null {
  const want = kind === "player" ? ["master-4star", "finishes-strip"] : ["staff-row"];
  for (const stem of want) {
    const hit = refs.find((r) => r.toLowerCase().startsWith(stem));
    if (hit) return hit;
  }
  return refs[0] ?? null;
}

export function Gallery({
  refs,
  initialOverlay,
  isStatic,
}: {
  refs: string[];
  initialOverlay: number;
  isStatic: boolean;
}) {
  return (
    <main
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-6 py-10"
      data-card-static={isStatic ? "1" : undefined}
    >
      <div>
        <p className="e24-eyebrow">Design sandbox — dev only</p>
        <h1 className="mt-1 text-xl font-bold text-white">Card system preview</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Five player finishes (identical sample data) + four staff roles.
          {refs.length === 0 && (
            <>
              {" "}
              No reference images found — drop the approved files into{" "}
              <code className="text-zinc-400">design/reference/</code> to enable
              overlay mode.
            </>
          )}
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="e24-eyebrow">Player — five finishes</h2>
        <div className="flex flex-wrap gap-8">
          {FINISH_ORDER.map((key) => (
            <CardEnvironment
              key={key}
              shot={`player-${FINISHES[key].stars}star`}
              label={`${"★".repeat(FINISHES[key].stars)} (${key})`}
              refs={refs}
              refDefault={defaultRef(refs, "player")}
              initialOverlay={initialOverlay}
            >
              <PlayerCard
                size="full"
                player={SAMPLE_PLAYER}
                team={SAMPLE_TEAM}
                finishOverride={key as FinishKey}
              />
            </CardEnvironment>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="e24-eyebrow">Staff — four roles</h2>
        <div className="flex flex-wrap gap-8">
          {SAMPLE_STAFF.map((s) => (
            <CardEnvironment
              key={s.shot}
              shot={s.shot}
              label={s.role}
              refs={refs}
              refDefault={defaultRef(refs, "staff")}
              initialOverlay={initialOverlay}
            >
              {/* Placeholder until Stage 8 builds the StaffCard family. */}
              <div className="flex h-[420px] w-[300px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-950/60 p-6 text-center">
                <p className="text-sm font-bold text-white">{s.name}</p>
                <p className="text-xs uppercase tracking-widest text-zinc-500">{s.role}</p>
                <p className="mt-4 text-[11px] text-zinc-600">StaffCard — Stage 8</p>
              </div>
            </CardEnvironment>
          ))}
        </div>
      </section>

      {/* Stage 7 — the recomposed sizes in their real contexts */}
      <section className="flex flex-col gap-4">
        <h2 className="e24-eyebrow">Recomposed sizes — in context</h2>
        <div className="flex max-w-xl flex-col gap-6">
          <div data-shot="context-wide">
            <PlayerCard size="wide" player={SAMPLE_PLAYER} team={SAMPLE_TEAM} />
          </div>
          <div
            data-shot="context-compact"
            className="flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3"
          >
            <FadedRow rank={2} />
            <PlayerCard size="compact" player={SAMPLE_PLAYER} team={SAMPLE_TEAM} />
            <FadedRow rank={3} />
          </div>
          <div
            data-shot="context-avatar"
            className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-2.5"
          >
            <span
              className="text-sm font-black italic tracking-tight text-white"
              style={{ fontFamily: "var(--font-barlow)" }}
            >
              Elite<span style={{ color: "#e1102a" }}>24</span>MVP
            </span>
            <PlayerCard size="avatar" player={SAMPLE_PLAYER} team={SAMPLE_TEAM} />
          </div>
        </div>
      </section>

      <PortraitDebug />
    </main>
  );
}

// A dim placeholder leaderboard row so the compact card reads in context.
function FadedRow({ rank }: { rank: number }) {
  return (
    <div className="flex h-[72px] items-center gap-3 rounded-xl bg-zinc-900/40 px-4 opacity-40">
      <span className="text-sm font-black tabular-nums text-zinc-500">#{rank}</span>
      <span className="h-9 w-9 rounded-full bg-zinc-800" />
      <span className="h-3 w-28 rounded bg-zinc-800" />
      <span className="ml-auto h-3 w-10 rounded bg-zinc-800" />
    </div>
  );
}

/**
 * One shootable environment: the card, a data-shot handle for the screenshot
 * rig, and its own reference-overlay controls.
 */
function CardEnvironment({
  shot,
  label,
  refs,
  refDefault,
  initialOverlay,
  children,
}: {
  shot: string;
  label: string;
  refs: string[];
  refDefault: string | null;
  initialOverlay: number;
  children: ReactNode;
}) {
  const [refFile, setRefFile] = useState<string | null>(refDefault);
  const [opacity, setOpacity] = useState(
    OPACITY_STOPS.includes(initialOverlay) ? initialOverlay : 0,
  );

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
        {label}
      </span>

      {/* The shot target: card + (optionally) the reference stretched to
          exactly the card's rendered dimensions. */}
      <div className="relative" data-shot={shot}>
        {children}
        {refFile && opacity > 0 && (
          // eslint-disable-next-line @next/next/no-img-element -- dev-only overlay, raw bytes wanted
          <img
            src={`/api/dev/reference/${encodeURIComponent(refFile)}`}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 z-50 h-full w-full"
            style={{ opacity: opacity / 100, objectFit: "fill" }}
          />
        )}
      </div>

      {refs.length > 0 && (
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <select
              value={refFile ?? ""}
              onChange={(e) => setRefFile(e.target.value || null)}
              className="max-w-[180px] rounded-lg border border-white/10 bg-black/40 px-2 py-1 text-[11px] text-zinc-300"
              aria-label={`Reference image for ${label}`}
            >
              <option value="">no overlay</option>
              {refs.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              type="range"
              min={0}
              max={100}
              step={25}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              className="w-24 accent-red-500"
              aria-label={`Overlay opacity for ${label}`}
            />
            <span className="w-9 text-right text-[11px] tabular-nums text-zinc-400">
              {opacity}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
