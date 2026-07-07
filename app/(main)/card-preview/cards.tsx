"use client";

import { useState } from "react";
import {
  PlayerCard,
  type CardPlayer,
  type CardTeam,
} from "@/app/components/PlayerCard";
import { TIERS } from "@/lib/cardTheme";

// Client iteration surface for the PlayerCard: a team-palette switcher (the real
// team + fake palettes) and a tier switcher, rendering all three sizes in their
// real-world contexts. Presentational only — no data writes.

type PaletteOpt = { key: string; label: string; team: CardTeam };

function palettes(realTeam: CardTeam): PaletteOpt[] {
  return [
    { key: "real", label: "Your team (real)", team: realTeam },
    {
      key: "mustang",
      label: "Mustang",
      team: {
        name: "Mustang Broncos",
        logoUrl: "/mustang-logo.png",
        primaryColor: "#c9223a",
        secondaryColor: "#f2a900",
      },
    },
    {
      key: "thunder",
      label: "Royal / Orange",
      team: {
        name: "Thunder",
        logoUrl: null,
        primaryColor: "#1e58c8",
        secondaryColor: "#ff7a1a",
      },
    },
    {
      key: "forest",
      label: "Forest / Gold",
      team: {
        name: "Ridgeline",
        logoUrl: null,
        primaryColor: "#1b5e20",
        secondaryColor: "#f2a900",
      },
    },
    {
      key: "purple",
      label: "Purple / Silver",
      team: {
        name: "Royals",
        logoUrl: null,
        primaryColor: "#5e35b1",
        secondaryColor: "#c0c0c0",
      },
    },
  ];
}

export function CardPreview({
  realPlayer,
  realTeam,
}: {
  realPlayer: CardPlayer;
  realTeam: CardTeam;
}) {
  const opts = palettes(realTeam);
  const [teamKey, setTeamKey] = useState("mustang");
  // null = use the player's actual points; else force a tier by its min.
  const [tierPoints, setTierPoints] = useState<number | null>(null);

  const team = opts.find((o) => o.key === teamKey)?.team ?? realTeam;
  const player: CardPlayer = {
    ...realPlayer,
    points: tierPoints ?? realPlayer.points,
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-10">
      <div>
        <p className="e24-eyebrow">Design sandbox</p>
        <h1 className="mt-1 text-xl font-bold text-white">PlayerCard preview</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Team-color-driven. Not wired into any real page yet.
        </p>
      </div>

      {/* Team palette switcher */}
      <div className="flex flex-col gap-2">
        <span className="e24-eyebrow">Team colors</span>
        <div className="flex flex-wrap gap-2">
          {opts.map((o) => {
            const p = o.team.primaryColor;
            const s = o.team.secondaryColor;
            const active = o.key === teamKey;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setTeamKey(o.key)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-white/60 bg-white/10 text-white"
                    : "border-white/15 text-zinc-400 hover:border-white/30"
                }`}
              >
                <span className="flex">
                  <span
                    className="h-3.5 w-3.5 rounded-full ring-1 ring-white/20"
                    style={{ background: p ?? "#e1102a" }}
                  />
                  <span
                    className="-ml-1 h-3.5 w-3.5 rounded-full ring-1 ring-white/20"
                    style={{ background: s ?? "#111" }}
                  />
                </span>
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tier switcher */}
      <div className="flex flex-col gap-2">
        <span className="e24-eyebrow">Tier (border)</span>
        <div className="flex flex-wrap gap-2">
          <TierButton
            label={`Actual (${realPlayer.points})`}
            active={tierPoints === null}
            onClick={() => setTierPoints(null)}
          />
          {TIERS.map((t) => (
            <TierButton
              key={t.key}
              label={`${t.label} (${t.min}+)`}
              active={tierPoints === t.min}
              onClick={() => setTierPoints(t.min)}
              dot={t.ring[Math.floor(t.ring.length / 2)]}
            />
          ))}
        </div>
      </div>

      {/* The three sizes in context */}
      <div className="flex flex-col items-start gap-12 lg:flex-row lg:items-start lg:gap-10">
        {/* FULL */}
        <div className="flex w-full flex-col items-center gap-3 lg:w-auto">
          <span className="e24-eyebrow">Full — tilt + tier border</span>
          <PlayerCard size="full" player={player} team={team} />
          <p className="text-center text-[11px] text-zinc-500">
            Hover (desktop) / drag (touch) to tilt.
          </p>
        </div>

        <div className="flex w-full flex-1 flex-col gap-10">
          {/* WIDE banner */}
          <div className="flex flex-col gap-3">
            <span className="e24-eyebrow">Wide — banner</span>
            <PlayerCard size="wide" player={player} team={team} />
          </div>

          {/* COMPACT in a fake leaderboard */}
          <div className="flex flex-col gap-3">
            <span className="e24-eyebrow">Compact — leaderboard row</span>
            <div className="flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3">
              <FakeRow rank={player.rank ? player.rank - 1 : 1} />
              <PlayerCard size="compact" player={player} team={team} />
              <FakeRow rank={player.rank ? player.rank + 1 : 3} />
            </div>
          </div>

          {/* AVATAR in a fake chat */}
          <div className="flex flex-col gap-3">
            <span className="e24-eyebrow">Avatar — chat message</span>
            <div className="flex items-start gap-2.5 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <PlayerCard size="avatar" player={player} team={team} />
              <div className="rounded-2xl rounded-tl-sm bg-zinc-800 px-3.5 py-2">
                <p className="text-xs font-semibold text-white">{player.name}</p>
                <p className="mt-0.5 text-sm text-zinc-200">
                  Let&apos;s get after it today 🔥
                </p>
              </div>
            </div>
          </div>

          {/* AVATAR in a fake header corner */}
          <div className="flex flex-col gap-3">
            <span className="e24-eyebrow">Avatar — header corner</span>
            <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950/60 px-4 py-2.5">
              <span
                className="text-sm font-black italic tracking-tight text-white"
                style={{ fontFamily: "var(--font-barlow)" }}
              >
                Elite<span style={{ color: "#e1102a" }}>24</span>MVP
              </span>
              <PlayerCard size="avatar" player={player} team={team} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function TierButton({
  label,
  active,
  onClick,
  dot,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-white/60 bg-white/10 text-white"
          : "border-white/15 text-zinc-400 hover:border-white/30"
      }`}
    >
      {dot && (
        <span
          className="h-2.5 w-2.5 rounded-full ring-1 ring-white/20"
          style={{ background: dot }}
        />
      )}
      {label}
    </button>
  );
}

// A dim placeholder leaderboard row so the compact card reads in context.
function FakeRow({ rank }: { rank: number }) {
  return (
    <div className="flex h-[72px] items-center gap-3 rounded-xl bg-zinc-900/40 px-4 opacity-40">
      <span className="text-sm font-black tabular-nums text-zinc-500">
        #{rank}
      </span>
      <span className="h-9 w-9 rounded-full bg-zinc-800" />
      <span className="h-3 w-28 rounded bg-zinc-800" />
      <span className="ml-auto h-3 w-10 rounded bg-zinc-800" />
    </div>
  );
}
