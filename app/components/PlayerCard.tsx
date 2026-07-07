"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  cardGradient,
  accentColor,
  numberColor,
  tierForPoints,
  withAlpha,
  shade,
  hexToRgb,
  BOTTOM_VIGNETTE,
  type Tier,
} from "@/lib/cardTheme";

// The flagship player identity card. ONE skeleton, three sizes, fully driven by
// team.primaryColor / secondaryColor (never hardcoded). Readability is a hard
// rule: text always sits on a dark scrim/panel, never colored-on-colored. The
// full size adds a holo tilt + a solid beveled-metal TIER border (the tier IS
// the border) with a diagonal light sweep that glints the metal edge. Self-
// contained: the keyframes live in a component <style> so globals.css stays
// untouched and the component is drop-in reusable later.

export type CardSize = "full" | "wide" | "compact" | "avatar";

export type CardPlayer = {
  name: string;
  jerseyNumber?: number | null;
  position?: string | null;
  heightInches?: number | null;
  rank?: number | null;
  points: number;
  photoUrl?: string | null;
  initials?: string | null;
};

export type CardTeam = {
  name: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

function makeInitials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function formatHeight(inches?: number | null): string | null {
  if (inches == null) return null;
  return `${Math.floor(inches / 12)}'${inches % 12}"`;
}

// A full, solid metallic ring — the tier "material". A conic sweep of the tier's
// stops gives each side a different tone (light catching a beveled frame). No gap,
// no spin: the border is a static shined-metal frame.
function conicMetal(colors: string[]): string {
  return `conic-gradient(from 130deg, ${colors.join(", ")}, ${colors[0]})`;
}

export function PlayerCard({
  size,
  player,
  team,
}: {
  size: CardSize;
  player: CardPlayer;
  team: CardTeam;
}) {
  if (size === "avatar") return <AvatarCard player={player} team={team} />;
  if (size === "compact") return <CompactCard player={player} team={team} />;
  if (size === "wide") return <WideCard player={player} team={team} />;
  return <FullCard player={player} team={team} />;
}

// Shared beveled-metal frame styling (the tier border) for full + wide. `radius`
// is the outer corner; `pad` the ring thickness.
function metalFrameStyle(tier: Tier, radius: number, pad: number): CSSProperties {
  return {
    position: "relative",
    background: conicMetal(tier.ring),
    padding: pad,
    borderRadius: radius,
    boxShadow: [
      "0 22px 46px -20px rgba(0,0,0,.65)", // drop shadow
      "0 0 0 1px rgba(0,0,0,.55)", // crisp outer edge line
      tier.glow ? `0 0 22px ${tier.glow}` : "", // outer tier glow (raised)
      "inset 0 1.5px 1px rgba(255,255,255,.30)", // top bevel highlight
      "inset 0 -2px 3px rgba(0,0,0,.55)", // bottom bevel shadow
    ]
      .filter(Boolean)
      .join(", "),
  };
}

// The thin dark line + inset top highlight between the metal ring and the face.
const BODY_EDGE = "0 0 0 1px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)";

// The giant ghosted jersey-number watermark. Outline-only, stroked in the team
// SECONDARY color when there is one (hollow, secondary-edged); otherwise a faint
// solid white fill (the original look). Shared by full + wide.
function GhostNumber({
  number,
  strokeColor,
  size,
  className,
}: {
  number: number;
  strokeColor: string | null;
  size: number;
  className: string;
}) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute select-none font-black italic leading-none ${className}`}
      style={{
        fontFamily: "var(--font-barlow)",
        fontSize: size,
        ...(strokeColor
          ? {
              color: "transparent",
              WebkitTextStrokeWidth: "2px",
              WebkitTextStrokeColor: strokeColor,
            }
          : { color: "rgba(255,255,255,0.08)" }),
      }}
    >
      {number}
    </span>
  );
}

// ---------------------------------------------------------------- FULL ------

function FullCard({ player, team }: { player: CardPlayer; team: CardTeam }) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => {
      mq.removeEventListener?.("change", sync);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  const gradient = cardGradient(team.primaryColor);
  const accent = accentColor(team.primaryColor, team.secondaryColor);
  const numColor = numberColor(team.primaryColor, team.secondaryColor);
  const hasSecondary = !!(team.secondaryColor && hexToRgb(team.secondaryColor));
  const initials = player.initials || makeInitials(player.name);
  const tier: Tier = tierForPoints(player.points);
  const height = formatHeight(player.heightInches);

  const setVars = (
    rx: number,
    ry: number,
    sc: number,
    sx: number,
    sy: number,
    on: boolean,
  ) => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", `${rx}deg`);
    el.style.setProperty("--ry", `${ry}deg`);
    el.style.setProperty("--sc", `${sc}`);
    el.style.setProperty("--sx", `${sx}%`);
    el.style.setProperty("--sy", `${sy}%`);
    el.style.setProperty("--so", on ? "1" : "0");
  };

  const track = (clientX: number, clientY: number, zoom: number) => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (clientX - r.left) / r.width;
    const py = (clientY - r.top) / r.height;
    const MAX = 11;
    const ry = (px - 0.5) * 2 * MAX;
    const rx = -(py - 0.5) * 2 * MAX;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() =>
      setVars(rx, ry, zoom, px * 100, py * 100, true),
    );
  };

  const rest = () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    setVars(0, 0, 1, 50, 50, false);
  };

  return (
    <div
      ref={ref}
      onPointerMove={(e) =>
        track(e.clientX, e.clientY, e.pointerType === "touch" ? 1.04 : 1)
      }
      onPointerLeave={rest}
      onPointerUp={rest}
      onPointerCancel={rest}
      className="pc-frame"
      style={{
        ...metalFrameStyle(tier, 24, 5),
        width: 320,
        touchAction: "none",
        transformStyle: "preserve-3d",
        willChange: "transform",
        transition: "transform 220ms cubic-bezier(.2,.7,.2,1)",
        transform:
          "perspective(1000px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)) scale(var(--sc,1))",
      }}
    >
      {/* Self-contained keyframes + reduced-motion fallback (namespaced pc-*). */}
      <style>{PC_STYLE}</style>

      {/* Diagonal light sweep: a moving band (screen blend) that brightens the
          card face AND catches a hot glint on the metal edge it crosses. Sits
          above the body (z) but is clipped to the card shape. Reduced motion
          disables it — the metal border stays a static gradient. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ borderRadius: 24, zIndex: 20 }}
      >
        {tier.sweepSec > 0 && (
          <span
            className="pc-sweep-band absolute inset-0"
            style={{
              mixBlendMode: "screen",
              background: `linear-gradient(115deg, rgba(255,255,255,0) 42%, ${withAlpha(
                "#ffffff",
                tier.glint,
              )} 50%, rgba(255,255,255,0) 58%)`,
              animationName: "pc-sweep",
              animationDuration: `${tier.sweepSec}s`,
              animationTimingFunction: "linear",
              animationIterationCount: "infinite",
              willChange: "transform",
            }}
          />
        )}
      </span>

      <div
        className="pc-body relative overflow-hidden"
        style={{
          background: gradient,
          borderRadius: 19,
          aspectRatio: "2.5 / 3.5",
          boxShadow: BODY_EDGE,
        }}
      >
        {/* ghosted jersey number — outline in the RAW secondary color (its true
            team color, not the readability-lightened one). Top-right corner. */}
        {player.jerseyNumber != null && (
          <GhostNumber
            number={player.jerseyNumber}
            strokeColor={
              hasSecondary ? withAlpha(team.secondaryColor as string, 0.4) : null
            }
            size={160}
            className={`${
              String(player.jerseyNumber).length <= 1 ? "right-8" : "right-2"
            } -top-1`}
          />
        )}

        {/* bottom vignette so name/stats always sit on darkness */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: BOTTOM_VIGNETTE }}
        />

        {/* pointer sheen */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: "var(--so,0)",
            transition: "opacity 200ms ease",
            mixBlendMode: "soft-light",
            background:
              "radial-gradient(circle at var(--sx,50%) var(--sy,50%), rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 45%)",
          }}
        />

        <div className="relative z-10 flex h-full flex-col p-4">
          {/* top row: logo chip */}
          <div className="flex items-start">
            <LogoChip team={team} size={66} />
          </div>

          {/* photo / initials */}
          <div className="mt-2 flex flex-1 items-center justify-center">
            <PhotoDisc
              initials={initials}
              photoUrl={player.photoUrl}
              accent={accent}
              size={196}
            />
          </div>

          {/* name + line */}
          <div>
            <h2
              className="truncate text-3xl font-black italic uppercase leading-[0.95] text-white"
              style={{
                fontFamily: "var(--font-barlow)",
                textShadow: "0 2px 12px rgba(0,0,0,0.5)",
              }}
            >
              {player.name}
            </h2>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">
              {player.jerseyNumber != null && (
                <span style={{ color: numColor }}>#{player.jerseyNumber}</span>
              )}
              {[player.position, height].filter(Boolean).map((part, i) => (
                <span key={i} className="flex items-center gap-2">
                  <span aria-hidden className="text-white/30">
                    ·
                  </span>
                  {part}
                </span>
              ))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- WIDE ------

// Horizontal banner (~16:10) — same design system as FULL, re-arranged: photo
// left, huge name right, #·pos·height under, team logo anchored right, ghost
// number behind the right half. Metallic tier border; NO tilt; no animated sweep
// (the gradient's built-in sheen carries the material feel).
function WideCard({ player, team }: { player: CardPlayer; team: CardTeam }) {
  const gradient = cardGradient(team.primaryColor);
  const accent = accentColor(team.primaryColor, team.secondaryColor);
  const numColor = numberColor(team.primaryColor, team.secondaryColor);
  const hasSecondary = !!(team.secondaryColor && hexToRgb(team.secondaryColor));
  const initials = player.initials || makeInitials(player.name);
  const tier = tierForPoints(player.points);
  const height = formatHeight(player.heightInches);

  return (
    <div style={{ ...metalFrameStyle(tier, 22, 5), width: 360, maxWidth: "100%" }}>
      <div
        className="pc-body relative overflow-hidden"
        style={{
          background: gradient,
          borderRadius: 17,
          aspectRatio: "16 / 10",
          boxShadow: BODY_EDGE,
        }}
      >
        {/* ghost number — lower-right so it clears the name up top. RAW secondary. */}
        {player.jerseyNumber != null && (
          <GhostNumber
            number={player.jerseyNumber}
            strokeColor={
              hasSecondary ? withAlpha(team.secondaryColor as string, 0.4) : null
            }
            size={120}
            className={`${
              String(player.jerseyNumber).length <= 1 ? "right-6" : "right-2"
            } bottom-1`}
          />
        )}
        {/* left scrim so the name stays on darkness over the watermark */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.12) 55%, rgba(0,0,0,0) 100%)",
          }}
        />
        {/* team logo anchored top-right */}
        <div className="absolute right-3 top-3 z-10">
          <LogoChip team={team} size={46} />
        </div>

        <div className="relative z-10 flex h-full flex-col p-4">
          {/* info line — top (clears the top-right logo via pr) */}
          <p className="flex flex-wrap items-center gap-x-2 pr-14 text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">
            {player.jerseyNumber != null && (
              <span style={{ color: numColor }}>#{player.jerseyNumber}</span>
            )}
            {[player.position, height].filter(Boolean).map((part, i) => (
              <span key={i} className="flex items-center gap-2">
                <span aria-hidden className="text-white/30">
                  ·
                </span>
                {part}
              </span>
            ))}
          </p>

          {/* photo + big name — aligned up so the name sits high, clear of the number */}
          <div className="flex flex-1 items-start gap-4">
            <PhotoDisc
              initials={initials}
              photoUrl={player.photoUrl}
              accent={accent}
              size={120}
            />
            <h2
              className="min-w-0 flex-1 pr-10 text-3xl font-black italic uppercase leading-[0.9] text-white"
              style={{
                fontFamily: "var(--font-barlow)",
                textShadow: "0 2px 12px rgba(0,0,0,0.5)",
              }}
            >
              {player.name}
            </h2>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- COMPACT -----

function CompactCard({
  player,
  team,
}: {
  player: CardPlayer;
  team: CardTeam;
}) {
  const gradient = cardGradient(team.primaryColor);
  const accent = accentColor(team.primaryColor, team.secondaryColor);
  const initials = player.initials || makeInitials(player.name);
  const tier = tierForPoints(player.points);

  return (
    <div
      className="relative flex h-[72px] w-full items-center gap-3 overflow-hidden rounded-xl pl-3 pr-4"
      style={{ background: gradient }}
    >
      {/* accent edge strip (team) */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: accent }}
      />
      {/* readability scrim (keeps right-side stats legible on lighter mids) */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.35), rgba(0,0,0,0.15) 45%, rgba(0,0,0,0.45))",
        }}
      />

      <div className="relative z-10 ml-1">
        <AvatarCard player={player} team={team} />
      </div>

      <div className="relative z-10 min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {/* tiny tier color cue */}
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: tier.ring[Math.floor(tier.ring.length / 2)] }}
            title={tier.label}
          />
          <p
            className="truncate text-base font-black italic uppercase leading-none text-white"
            style={{ fontFamily: "var(--font-barlow)" }}
          >
            {player.name}
          </p>
        </div>
        <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">
          {player.jerseyNumber != null ? `#${player.jerseyNumber} · ` : ""}
          {player.position ?? "Player"}
        </p>
      </div>

      <div className="relative z-10 shrink-0 text-right">
        {player.rank != null && (
          <p
            className="text-lg font-black leading-none tabular-nums text-white"
            style={{ color: shade(accent, 0.3) }}
          >
            #{player.rank}
          </p>
        )}
        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/70 tabular-nums">
          {player.points} pts
        </p>
      </div>

      <span aria-hidden className="hidden">
        {initials}
      </span>
    </div>
  );
}

// --------------------------------------------------------------- AVATAR -----

function AvatarCard({ player, team }: { player: CardPlayer; team: CardTeam }) {
  const gradient = cardGradient(team.primaryColor);
  const accent = accentColor(team.primaryColor, team.secondaryColor);
  const initials = player.initials || makeInitials(player.name);
  const base =
    team.primaryColor && team.primaryColor.startsWith("#")
      ? team.primaryColor
      : accent;

  return (
    <div
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full"
      style={{ background: `linear-gradient(140deg, ${accent}, ${shade(base, -0.4)})`, padding: 2 }}
    >
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-full"
        style={{ background: gradient }}
      >
        {player.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.photoUrl}
            alt={player.name}
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          <span
            className="text-xs font-black uppercase text-white"
            style={{ fontFamily: "var(--font-barlow)" }}
          >
            {initials}
          </span>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- SHARED -----

function LogoChip({ team, size }: { team: CardTeam; size: number }) {
  if (team.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={team.logoUrl}
        alt={`${team.name} logo`}
        style={{ width: size, height: size }}
        className="shrink-0 object-contain drop-shadow-[0_2px_5px_rgba(0,0,0,0.5)]"
      />
    );
  }
  // No logo → a small team-initial chip.
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg bg-black/40 font-black uppercase text-white ring-1 ring-white/15"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {makeInitials(team.name)}
    </span>
  );
}

function PhotoDisc({
  initials,
  photoUrl,
  accent,
  size,
}: {
  initials: string;
  photoUrl?: string | null;
  accent: string;
  size: number;
}) {
  return (
    <div
      className="relative flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        boxShadow: `inset 0 0 0 2px ${withAlpha(accent, 0.85)}, inset 0 0 0 7px rgba(0,0,0,0.22), inset 0 8px 26px rgba(0,0,0,0.4)`,
        background:
          "radial-gradient(120% 120% at 50% 22%, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.5) 100%)",
      }}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span
          className="font-black uppercase italic text-white"
          style={{
            fontFamily: "var(--font-barlow)",
            fontSize: size * 0.36,
            textShadow: "0 2px 10px rgba(0,0,0,0.5)",
          }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}

// Keyframes for the diagonal light sweep. Namespaced pc-* and injected inline so
// globals.css is never touched. Reduced motion halts the sweep entirely — the
// metal border stays its static gradient (no movement).
const PC_STYLE = `
@keyframes pc-sweep { 0% { transform: translateX(-150%); } 100% { transform: translateX(150%); } }
@media (prefers-reduced-motion: reduce) {
  .pc-sweep-band { animation: none !important; opacity: 0 !important; }
}
`;
