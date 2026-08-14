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
  APP_RED,
  FINISHES,
  finishForStars,
  starsForPoints,
  type Tier,
  type Finish,
  type FinishKey,
} from "@/lib/cardTheme";
import {
  BASE_WIDTH,
  CARD_ASPECT,
  NUMBER_ZONE,
  NUMBER_SIZE,
  PORTRAIT,
  FIRST_NAME,
  DETAILS,
  STAT_BAR,
  STAT_PANELS,
  STARS,
  FOOTER,
  FOOTER_TEXT_SIZE,
  zoneStyle,
  giantNumber,
  surnameSize,
} from "@/lib/cardGeometry";
import { cutoutCss, isPortraitMetaV2 } from "@/lib/portrait/normalize";
import { CardFrame, FaceBevel } from "@/app/components/card/CardFrame";
import { CardStars } from "@/app/components/card/CardStars";
import { DepthShadow, RimLight } from "@/app/components/card/CutoutLighting";
import { TeamLogoBadge, TopRightSlot } from "@/app/components/card/TeamLogoBadge";
import { CLIP_FACE, CLIP_OUTER } from "@/app/components/card/chrome";

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
  /** Career total (drives stars/finish); falls back to `points` when absent. */
  total?: number;
  /** Roster size for the LEADERBOARD panel ("#1 of 7"). */
  rosterSize?: number | null;
  photoUrl?: string | null;
  /** Card-portrait cutout (photo pipeline A) + its normalization meta (v2). */
  cutoutUrl?: string | null;
  photoMeta?: unknown;
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
  finishOverride,
  staticRender = false,
}: {
  size: CardSize;
  player: CardPlayer;
  team: CardTeam;
  /**
   * DEV PREVIEW ONLY (card-preview gallery): force a material finish
   * regardless of points, so the five finish environments can share identical
   * sample data.
   */
  finishOverride?: FinishKey;
  /** Freeze all dynamic finish motion + tilt (regression baselines, Δ11). */
  staticRender?: boolean;
}) {
  if (size === "avatar") return <AvatarCard player={player} team={team} />;
  if (size === "compact") return <CompactCard player={player} team={team} />;
  if (size === "wide") return <WideCard player={player} team={team} />;
  return (
    <FullCard
      player={player}
      team={team}
      finishOverride={finishOverride}
      staticRender={staticRender}
    />
  );
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
//
// THE LOCKED PLAYER CARD (card redesign Stage 5). One geometry
// (lib/cardGeometry — provisional until ★ GEOMETRY LOCKED ★), five material
// finishes (lib/cardTheme FINISHES). Thirteen layers, bottom → top:
//  1  chamfered metal frame (finish colorway)            <CardFrame>
//  2  card-face environment (dark foundation + tint)
//  3  giant leading-zero number, finish-lit
//  4  lighting 1 — environmental backlight
//  §23 depth separation shadow                            <DepthShadow>
//  5  cutout athlete (normalized transform, Stage 4)
//  6  lighting 2 — face-aware rim light                   <RimLight>
//  7  lighting 3 — local atmospheric spill
//  8  name block (surname = metallic material, Δ13)
//  9  details line (#7 un-padded)
// 10  stat bar: POINTS · LEADERBOARD · TIER (earned stars only)
// 11  ELITE24MVP footer tab
// 12  team logo top-left (Δ9 normalized) + EMPTY top-right slot (Δ10)
// 13  foil system — card surfaces only; the FACE is a hard exclusion (Δ13)

/** Card-face background noise (fine static grain — the "material"). */
const NOISE_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E";

function FullCard({
  player,
  team,
  finishOverride,
  staticRender = false,
}: {
  player: CardPlayer;
  team: CardTeam;
  finishOverride?: FinishKey;
  staticRender?: boolean;
}) {
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

  const accent = accentColor(team.primaryColor, team.secondaryColor);
  const initials = player.initials || makeInitials(player.name);
  const height = formatHeight(player.heightInches);

  // Finish selection — career total drives stars; a level change may only
  // ever swap finish tokens, never geometry (Δ4).
  const total = player.total ?? player.points;
  const earnedStars = starsForPoints(total);
  const finish: Finish = finishOverride
    ? FINISHES[finishOverride]
    : finishForStars(earnedStars);
  const shownStars = finishOverride ? finish.stars : earnedStars;

  // Portrait: only a real cutout renders as the hero (a rectangular photo in
  // the hero zone is a different product); no cutout → clearly-pending state.
  const meta = isPortraitMetaV2(player.photoMeta) ? player.photoMeta : null;
  const cutout = player.cutoutUrl ?? null;

  // Name split: dominant surname = last word; everything before sits above.
  const words = player.name.trim().split(/\s+/);
  const surname = words.length > 1 ? words[words.length - 1] : words[0];
  const firstName = words.length > 1 ? words.slice(0, -1).join(" ") : null;

  // Pixel scale: geometry fractions × the card's px height.
  const W = BASE_WIDTH;
  const H = W / CARD_ASPECT;
  const fs = (frac: number) => frac * H;

  const bigNumber = giantNumber(player.jerseyNumber);

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

  const cutoutPlacement = meta ? cutoutCss(meta) : null;
  const spectral = finish.spectral.join(", ");

  return (
    <div
      ref={ref}
      onPointerMove={
        staticRender
          ? undefined
          : (e) => track(e.clientX, e.clientY, e.pointerType === "touch" ? 1.04 : 1)
      }
      onPointerLeave={staticRender ? undefined : rest}
      onPointerUp={staticRender ? undefined : rest}
      onPointerCancel={staticRender ? undefined : rest}
      className={`pc-frame relative${staticRender ? " pc-static" : ""}`}
      style={{
        width: W,
        aspectRatio: `${CARD_ASPECT}`,
        touchAction: "none",
        transformStyle: "preserve-3d",
        willChange: "transform",
        transition: staticRender ? undefined : "transform 220ms cubic-bezier(.2,.7,.2,1)",
        transform: staticRender
          ? undefined
          : "perspective(1000px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg)) scale(var(--sc,1))",
        filter: `drop-shadow(0 22px 30px rgba(0,0,0,0.55))${
          finish.foilIntensity > 0.3
            ? ` drop-shadow(0 0 22px ${withAlpha(finish.lightHue, 0.18 * finish.foilIntensity)})`
            : ""
        }`,
        ...(staticRender
          ? ({ "--sx": "50%", "--sy": "32%", "--so": "0" } as CSSProperties)
          : null),
      }}
    >
      {/* Self-contained keyframes + reduced-motion fallback (namespaced pc-*). */}
      <style>{PC_STYLE}</style>

      {/* 1 · chamfered metal frame + its foil (Δ13: never over the face) */}
      <CardFrame finish={finish} />

      {/* the card FACE — everything inside the metal ring */}
      <div className="absolute inset-0" style={{ clipPath: CLIP_FACE }}>
        {/* 2 · environment: dark foundation + faint team tint (finish owns
            identity — §51; the team is an environmental accent only) */}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              `radial-gradient(110% 65% at 50% -8%, ${withAlpha(finish.lightHue, 0.16)} 0%, transparent 60%),` +
              `radial-gradient(120% 80% at 50% 115%, ${withAlpha(accent, 0.1)} 0%, transparent 55%),` +
              `linear-gradient(168deg, ${finish.background.top} 0%, ${finish.background.mid} 52%, ${finish.background.bottom} 100%)`,
          }}
        />
        {/* 13c · background material: grain + a whisper of spectral sheen —
            sits UNDER the athlete, so the face physically can't receive foil */}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage: `url("${NOISE_URI}")`,
            backgroundSize: "160px 160px",
            mixBlendMode: "overlay",
            opacity: 0.05 + 0.07 * finish.foilIntensity,
          }}
        />
        {finish.foilIntensity > 0.1 && (
          <span
            aria-hidden
            className="absolute inset-0"
            style={{
              mixBlendMode: "color-dodge",
              opacity: 0.06 * finish.foilIntensity,
              background: `linear-gradient(115deg, ${spectral})`,
              backgroundSize: "300% 300%",
              backgroundPosition: "calc(var(--sx,50%)) calc(var(--sy,32%))",
            }}
          />
        )}

        {/* 3 · GIANT NUMBER — leading zero, condensed, finish-lit outline */}
        {bigNumber && (
          <div
            aria-hidden
            className="pointer-events-none absolute flex items-start justify-center select-none"
            style={zoneStyle(NUMBER_ZONE)}
          >
            <span
              className="relative font-black italic leading-none"
              style={{
                fontFamily: "var(--font-barlow)",
                fontSize: fs(NUMBER_SIZE),
                letterSpacing: "-0.04em",
                color: "transparent",
                WebkitTextStrokeWidth: 2,
                WebkitTextStrokeColor: withAlpha(finish.metalHighlight, 0.5),
                backgroundImage: `linear-gradient(180deg, ${withAlpha(
                  finish.metalHighlight,
                  0.14,
                )} 0%, ${withAlpha(finish.metalHighlight, 0.03)} 60%, transparent 100%)`,
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                filter: `drop-shadow(0 0 ${Math.round(
                  10 + 14 * finish.lightIntensity,
                )}px ${withAlpha(finish.lightHue, 0.3 * finish.lightIntensity)})`,
              }}
            >
              {bigNumber}
            </span>
          </div>
        )}

        {/* 4 · LIGHTING 1: environmental backlight behind head/shoulders */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            mixBlendMode: "screen",
            background: `radial-gradient(46% 34% at 50% ${(PORTRAIT.eyeY + 0.06) * 100}%, ${withAlpha(
              finish.lightHue,
              0.26 * finish.lightIntensity + 0.08,
            )} 0%, transparent 100%)`,
          }}
        />

        {/* 5/6/§23 · the athlete (torso fades out above the name block) */}
        <div
          className="absolute inset-0"
          style={{
            WebkitMaskImage: `linear-gradient(180deg, #fff 0%, #fff ${(PORTRAIT.bottomY - 0.055) * 100}%, transparent ${PORTRAIT.bottomY * 100}%)`,
            maskImage: `linear-gradient(180deg, #fff 0%, #fff ${(PORTRAIT.bottomY - 0.055) * 100}%, transparent ${PORTRAIT.bottomY * 100}%)`,
          }}
        >
          {cutout && cutoutPlacement && meta ? (
            <>
              <DepthShadow src={cutout} meta={meta} style={cutoutPlacement} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cutout}
                alt={player.name}
                className="absolute"
                style={cutoutPlacement}
              />
              <RimLight src={cutout} meta={meta} finish={finish} style={cutoutPlacement} />
            </>
          ) : cutout ? (
            // Seeded/meta-less cutout: best-effort contain in the safe zone.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cutout}
              alt={player.name}
              className="absolute left-1/2 -translate-x-1/2 object-contain object-bottom"
              style={{
                bottom: `${(1 - PORTRAIT.bottomY) * 100}%`,
                maxWidth: `${PORTRAIT.maxW * 100}%`,
                height: `${(PORTRAIT.bottomY - PORTRAIT.zone.y) * 100}%`,
              }}
            />
          ) : (
            // CLEARLY-PENDING placeholder (Δ5 concern 7): initials, not a
            // "finished" card — the finish stays quiet here on purpose.
            <div
              className="absolute flex flex-col items-center justify-center gap-2"
              style={zoneStyle(PORTRAIT.zone)}
            >
              <span
                className="flex items-center justify-center rounded-full border-2 border-dashed"
                style={{
                  width: fs(0.17),
                  height: fs(0.17),
                  borderColor: withAlpha(finish.metalHighlight, 0.3),
                  background: "rgba(0,0,0,0.35)",
                }}
              >
                <span
                  className="font-black uppercase italic text-white/85"
                  style={{ fontFamily: "var(--font-barlow)", fontSize: fs(0.055) }}
                >
                  {initials}
                </span>
              </span>
              <span
                className="font-bold uppercase"
                style={{
                  fontSize: fs(0.017),
                  letterSpacing: "0.22em",
                  color: withAlpha(finish.metalHighlight, 0.45),
                }}
              >
                Photo pending
              </span>
            </div>
          )}
        </div>

        {/* 7 · LIGHTING 3: local atmospheric spill (never over face or name) */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            mixBlendMode: "screen",
            opacity: 0.5 + 0.5 * finish.lightIntensity,
            background:
              `radial-gradient(18% 10% at 18% ${PORTRAIT.shoulderY * 100}%, ${withAlpha(finish.lightHue, 0.16)} 0%, transparent 100%),` +
              `radial-gradient(18% 10% at 82% ${PORTRAIT.shoulderY * 100}%, ${withAlpha(finish.lightHue, 0.14)} 0%, transparent 100%)`,
          }}
        />

        {/* pointer sheen — card surfaces only: sits UNDER the athlete? No —
            it must read as light on the card; masked OFF the portrait face
            zone so skin never takes the sheen (Δ13 hard exclusion). */}
        {!staticRender && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              opacity: "var(--so,0)",
              transition: "opacity 200ms ease",
              mixBlendMode: "soft-light",
              background:
                "radial-gradient(circle at var(--sx,50%) var(--sy,50%), rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 46%)",
              WebkitMaskImage: `radial-gradient(38% 26% at 50% ${PORTRAIT.eyeY * 100}%, transparent 0%, transparent 55%, #fff 100%)`,
              maskImage: `radial-gradient(38% 26% at 50% ${PORTRAIT.eyeY * 100}%, transparent 0%, transparent 55%, #fff 100%)`,
            }}
          />
        )}

        {/* bottom vignette: name/stat zone always sits on darkness */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: BOTTOM_VIGNETTE }}
        />

        {/* 8 · NAME BLOCK */}
        <div
          className="pointer-events-none absolute left-0 right-0 text-center"
          style={{ top: `${FIRST_NAME.y * 100}%` }}
        >
          {firstName && (
            <p
              className="font-bold uppercase leading-none"
              style={{
                fontSize: fs(FIRST_NAME.size),
                letterSpacing: FIRST_NAME.tracking,
                color: accent,
                textShadow: "0 1px 6px rgba(0,0,0,0.7)",
              }}
            >
              {firstName}
            </p>
          )}
          {/* SURNAME — premium metallic material (Δ13): silver/white gradient,
              dimensional depth copy, restrained tilt-responsive highlight.
              Never flat browser text; never a rainbow sweep. */}
          <div className="relative mt-[0.35em] leading-none" style={{ fontSize: fs(surnameSize(surname)) }}>
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 font-black uppercase italic"
              style={{
                fontFamily: "var(--font-barlow)",
                transform: "translateY(0.045em)",
                color: "rgba(0,0,0,0.6)",
                letterSpacing: "0.01em",
              }}
            >
              {surname}
            </span>
            <span
              className="relative font-black uppercase italic"
              style={{
                fontFamily: "var(--font-barlow)",
                letterSpacing: "0.01em",
                color: "transparent",
                backgroundImage:
                  "linear-gradient(180deg, #ffffff 0%, #eef2f6 42%, #a7b2bf 55%, #e3e9f0 74%, #cfd7df 100%)",
                backgroundSize: "100% 200%",
                backgroundPositionY: "calc(var(--sy, 32%) * 0.2)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.55))",
              }}
            >
              {surname}
            </span>
          </div>
        </div>

        {/* 9 · DETAILS LINE (#7 un-padded — the leading zero is layer 3 only) */}
        <p
          className="pointer-events-none absolute left-0 right-0 text-center font-bold uppercase"
          style={{
            top: `${DETAILS.y * 100}%`,
            fontSize: fs(DETAILS.size),
            letterSpacing: DETAILS.tracking,
            color: "rgba(255,255,255,0.82)",
          }}
        >
          {[
            player.jerseyNumber != null ? `#${player.jerseyNumber}` : null,
            player.position,
            height,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {/* 10 · STAT BAR — POINTS · LEADERBOARD · TIER */}
        <div
          className="pointer-events-none absolute grid grid-cols-3"
          style={{ ...zoneStyle(STAT_BAR), gap: `${STAT_PANELS.gap * 100}%` }}
        >
          <StatPanel
            finish={finish}
            label="Points"
            value={String(total)}
            fs={fs}
          />
          <StatPanel
            finish={finish}
            label="Leaderboard"
            value={
              player.rank != null
                ? `#${player.rank}${player.rosterSize ? ` of ${player.rosterSize}` : ""}`
                : "—"
            }
            fs={fs}
          />
          <div
            className="flex flex-col items-center justify-center rounded-md"
            style={statPanelStyle(finish)}
          >
            <span
              className="font-bold uppercase"
              style={{
                fontSize: fs(STAT_PANELS.headerSize),
                letterSpacing: "0.18em",
                color: withAlpha(finish.metalHighlight, 0.65),
              }}
            >
              Tier
            </span>
            <span className="mt-[0.2em]">
              <CardStars
                count={shownStars}
                finish={finish}
                sizePx={fs(STARS.size)}
                gapPx={fs(STARS.gap)}
              />
            </span>
            <span
              className="mt-[0.25em] font-bold uppercase text-white/85"
              style={{ fontSize: fs(STARS.captionSize), letterSpacing: "0.3em" }}
            >
              Prospect
            </span>
          </div>
        </div>

        {/* 11 · ELITE24MVP footer tab (maker's mark — §29/§53) */}
        <div
          className="pointer-events-none absolute flex items-center justify-center rounded-t-md"
          style={{
            ...zoneStyle(FOOTER),
            background: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(0,0,0,0.4))",
            boxShadow: `inset 0 1px 0 ${withAlpha(finish.metalHighlight, 0.2)}, inset 0 0 0 1px rgba(0,0,0,0.4)`,
          }}
        >
          <span
            className="font-black italic uppercase leading-none text-white"
            style={{ fontFamily: "var(--font-barlow)", fontSize: fs(FOOTER_TEXT_SIZE) }}
          >
            Elite<span style={{ color: APP_RED }}>24</span>MVP
          </span>
        </div>

        {/* 12 · team logo (top-left, Δ9) + intentionally-empty top-right slot */}
        <TeamLogoBadge logoUrl={team.logoUrl} />
        <TopRightSlot />
      </div>

      {/* face bevel edge (above the face stack, hugging the ring) */}
      <FaceBevel finish={finish} />

      {/* 13d · the traveling sweep — finish-scaled, paused when static */}
      {finish.foilIntensity > 0.12 && !staticRender && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ clipPath: CLIP_OUTER }}
        >
          <span
            className="pc-sweep-band absolute inset-0"
            style={{
              mixBlendMode: "screen",
              background: `linear-gradient(115deg, rgba(255,255,255,0) 42%, ${withAlpha(
                "#ffffff",
                0.07 + 0.2 * finish.foilIntensity,
              )} 50%, rgba(255,255,255,0) 58%)`,
              animationName: "pc-sweep",
              animationDuration: `${7 - 2.2 * finish.foilIntensity}s`,
              animationTimingFunction: "linear",
              animationIterationCount: "infinite",
              willChange: "transform",
            }}
          />
        </span>
      )}
    </div>
  );
}

/** One POINTS/LEADERBOARD panel of the stat bar. */
function StatPanel({
  finish,
  label,
  value,
  fs,
}: {
  finish: Finish;
  label: string;
  value: string;
  fs: (frac: number) => number;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-md"
      style={statPanelStyle(finish)}
    >
      <span
        className="font-bold uppercase"
        style={{
          fontSize: fs(STAT_PANELS.headerSize),
          letterSpacing: "0.18em",
          color: withAlpha(finish.metalHighlight, 0.65),
        }}
      >
        {label}
      </span>
      <span
        className="mt-[0.15em] font-black tabular-nums leading-none text-white"
        style={{ fontFamily: "var(--font-barlow)", fontSize: fs(STAT_PANELS.valueSize) }}
      >
        {value}
      </span>
    </div>
  );
}

function statPanelStyle(finish: Finish): CSSProperties {
  return {
    background: "rgba(0,0,0,0.45)",
    boxShadow: `inset 0 0 0 1px ${withAlpha(finish.metalHighlight, 0.14)}, inset 0 1px 0 ${withAlpha(
      finish.metalHighlight,
      0.1,
    )}`,
  };
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
.pc-static, .pc-static * { animation-play-state: paused !important; }
`;
