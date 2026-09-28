"use client";
import { useId } from "react";
import type { Finish } from "@/lib/cardTheme";
import { APP_RED } from "@/lib/cardTheme";
import { finishAssets } from "@/lib/cardAssets";
import {
  NUMBER_ZONE,
  NUMBER_FONT_SIZE,
  FIRST_NAME,
  SURNAME,
  DETAILS,
  STAT_RAIL,
  STAT_COLUMNS,
  STAT_PANELS,
  STARS,
  FOOTER,
  FOOTER_FONT_SIZE,
  u,
  zoneStyle,
} from "@/lib/cardGeometry";
import { CardStars } from "./CardStars";

const FONT = "var(--font-barlow), sans-serif";
/** Gradient stop offsets for the palette's color lists. */
const NUMBER_BODY_STOPS = [0, 0.25, 0.44, 0.57, 0.73, 0.88, 1];
const NUMBER_EDGE_STOPS = [0, 0.42, 0.7, 1];
const FIRST_NAME_STOPS = [0, 0.35, 0.65, 1];
const STAT_VALUE_STOPS = [0, 0.5, 1];
/** The leaderboard value stays neutral chrome on every level. */
const RANK_VALUE = ["#ffffff", "#c9d1d9", "#f1f4f8"];

/** Text stays live; the level's energy field supplies its foil surface.
 * Separate dark extrusion, fine edge and broad bloom give actual visual depth. */
export function GiantNumber({ text, finish }: { text: string; finish: Finish }) {
  const id = useId().replace(/:/g, "");
  if (!text) return null;
  const colors = finish.palette.number;
  const [sheenA, sheenB, sheenC] = colors.sheen;
  const glyph = (
    <text x="349" y="540" textAnchor="middle" fontFamily="var(--font-roboto), sans-serif" fontWeight="900"
      fontSize={NUMBER_FONT_SIZE} textLength="670" lengthAdjust="spacingAndGlyphs">
      {text}
    </text>
  );
  return (
    <svg aria-hidden data-layer="giant-number" className="pointer-events-none absolute overflow-visible"
      style={zoneStyle(NUMBER_ZONE)} viewBox="0 0 698 550" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`num-${id}`} x1="0" y1="0" x2=".8" y2="1">
          {colors.body.map((color, i) => <stop key={i} offset={NUMBER_BODY_STOPS[i]} stopColor={color} />)}
        </linearGradient>
        <linearGradient id={`edge-${id}`} x1="0" y1="0" x2=".2" y2="1">
          {colors.edge.map((color, i) => <stop key={i} offset={NUMBER_EDGE_STOPS[i]} stopColor={color} />)}
        </linearGradient>
        <clipPath id={`numclip-${id}`}>{glyph}</clipPath>
        <filter id={`num-flare-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency=".045 .08" numOctaves="2" seed="17" result="rough" />
          <feDisplacementMap in="SourceGraphic" in2="rough" scale="13" xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation=".65" />
        </filter>
        <filter id={`aura-${id}`} x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="17" /></filter>
        <filter id={`bloom-${id}`} x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      {/* Glow weights raised at the owner's review (2026-09-26: "brighter
          number glow", like B3): wider/stronger aura + bloom, thicker bright
          edge and white core. */}
      <g transform="translate(3 8)" fill={colors.extrude} stroke={colors.extrudeEdge} strokeWidth="10">{glyph}</g>
      <g fill="none" stroke={colors.aura} strokeWidth="34" opacity=".95" filter={`url(#aura-${id})`}>{glyph}</g>
      <g fill="none" stroke={colors.bloom} strokeWidth="22" opacity="1" filter={`url(#bloom-${id})`}>{glyph}</g>
      <g fill={`url(#num-${id})`}>{glyph}</g>
      <image href={finishAssets(finish.key).field.file} x="-100" y="-110" width="900" height="1350" preserveAspectRatio="none"
        style={{ filter: "brightness(1.7) saturate(1.15)" }} clipPath={`url(#numclip-${id})`} />
      <g fill="none" stroke={colors.flare} strokeWidth="3" opacity=".95" filter={`url(#num-flare-${id})`}>{glyph}</g>
      <g fill="none" stroke={`url(#edge-${id})`} strokeWidth="11">{glyph}</g>
      <g fill="none" stroke={colors.core} strokeWidth="3.8">{glyph}</g>
      <foreignObject x="-10" y="-10" width="720" height="580" clipPath={`url(#numclip-${id})`} style={{ mixBlendMode: "screen", opacity: .12 }}>
        <div style={{
          width: "100%",
          height: "100%",
          background: `linear-gradient(120deg, transparent 28%, ${sheenA} 43%, ${sheenB} 47%, ${sheenC} 52%, transparent 68%)`,
          backgroundSize: "240% 200%",
          backgroundPosition: "var(--sx, 40%) var(--sy, 32%)",
        }} />
      </foreignObject>
    </svg>
  );
}

/** A shared baseline and explicit text widths keep the reference composition
 * stable across names, viewport sizes and font loading. */
export function NameBlock({ firstName, surname, finish }: { firstName: string | null; surname: string; finish: Finish }) {
  const id = useId().replace(/:/g, "");
  const nameLength = surname.length <= 4 ? 430 : 592;
  const { palette } = finish;
  return <>
    {firstName && (
      <svg data-layer="first-name" aria-label={firstName} className="pointer-events-none absolute overflow-visible"
        style={zoneStyle(FIRST_NAME.zone)} viewBox="0 0 660 70">
        <defs>
          <linearGradient id={`first-${id}`} x1="0" y1="0" x2="0" y2="1">
            {palette.firstName.map((color, i) => <stop key={i} offset={FIRST_NAME_STOPS[i]} stopColor={color} />)}
          </linearGradient>
        </defs>
        <text x="0" y="59" fontFamily="var(--font-card-display), sans-serif" fontSize={FIRST_NAME.fontSize}
          transform="translate(10 0) skewX(-12)" fontWeight="700" fontStyle="normal" letterSpacing="6"
          textLength={Math.min(580, firstName.length * 47)} lengthAdjust="spacingAndGlyphs" fill={`url(#first-${id})`}
          stroke={finish.metalHighlight} strokeWidth=".8" paintOrder="stroke"
          style={{ filter: `drop-shadow(1px 2px 1px ${palette.firstNameShadow})` }}>
          {firstName.toUpperCase()}
        </text>
      </svg>
    )}
    <svg data-layer="surname" aria-label={surname} className="pointer-events-none absolute overflow-visible"
      style={zoneStyle(SURNAME.zone)} viewBox="0 0 685 120">
      <defs>
        <linearGradient id={`name-${id}`} x1="0" y1="0" x2=".08" y2="1">
          <stop stopColor="#fcfdff" /><stop offset=".25" stopColor="#f5f6f8" /><stop offset=".45" stopColor="#b8bec5" />
          <stop offset=".66" stopColor="#383e47" /><stop offset=".88" stopColor="#161d26" /><stop offset="1" stopColor="#626e7c" />
        </linearGradient>
      </defs>
      <text x="23" y="115" fontFamily="var(--font-card-display), sans-serif" fontSize="157" letterSpacing="4" transform="skewX(-12)"
        fontWeight="700" fontStyle="normal" textLength={nameLength} lengthAdjust="spacingAndGlyphs" fill="#020609" stroke="#010305" strokeWidth="3">
        {surname.toUpperCase()}
      </text>
      <text x="21" y="112" fontFamily="var(--font-card-display), sans-serif" fontSize="157" letterSpacing="4" transform="skewX(-12)"
        fontWeight="700" fontStyle="normal" textLength={nameLength} lengthAdjust="spacingAndGlyphs" fill={`url(#name-${id})`}
        stroke="#edf6ff" strokeWidth="1.3" paintOrder="stroke">
        {surname.toUpperCase()}
      </text>
    </svg>
  </>;
}

export function DetailsLine({ parts, finish }: { parts: (string | null | undefined)[]; finish: Finish }) {
  const items = parts.filter((part): part is string => Boolean(part));
  const { palette } = finish;
  return (
    <svg data-layer="details" aria-label={items.join(" · ")} className="pointer-events-none absolute" style={zoneStyle(DETAILS.zone)} viewBox="0 0 600 62">
      <text x="300" y="42" textAnchor="middle" fontFamily={FONT} fontSize="42" fontWeight="600" fontStyle="normal" letterSpacing="3"
        textLength="570" lengthAdjust="spacingAndGlyphs" transform="translate(5 0) skewX(-7)" fill="#d2dce5">
        {items.map((part, i) => (
          <tspan key={i}>
            {i > 0 && <tspan fill={palette.separator}> · </tspan>}
            <tspan fill={i === 0 ? palette.accent : undefined}>{part.toUpperCase()}</tspan>
          </tspan>
        ))}
      </text>
    </svg>
  );
}

export function StatRailText({ points, rankText, stars, finish }: { points: number; rankText: string; stars: number; finish: Finish }) {
  const id = useId().replace(/:/g, "");
  const { palette } = finish;
  return <>
    {STAT_COLUMNS.map((col, i) => (
      <svg key={i} data-layer={["stat-points", "stat-rank", "stat-tier"][i]} className="pointer-events-none absolute overflow-visible"
        style={{ left: u(col.x), top: u(STAT_RAIL.y), width: u(col.w), height: u(STAT_RAIL.h) }} viewBox={`0 0 ${col.w} ${STAT_RAIL.h}`}>
        <defs>
          <linearGradient id={`stat-${id}-${i}`} x1="0" y1="0" x2="0" y2="1">
            {(i === 0 ? palette.statValue : RANK_VALUE).map((color, s) => <stop key={s} offset={STAT_VALUE_STOPS[s]} stopColor={color} />)}
          </linearGradient>
        </defs>
        <text x={col.w / 2} y="45" textAnchor="middle" fontFamily={FONT} fontWeight="600" fontSize={STAT_PANELS.headerFontSize}
          letterSpacing="2" fill={palette.statHeader}>
          {["POINTS", "LEADERBOARD", "TIER"][i]}
        </text>
        {i < 2 ? (
          <text x={col.w / 2} y="129" textAnchor="middle" fontFamily={FONT} fontWeight="900"
            fontSize={i === 0 ? Math.min(82, 370 / String(points).length) : Math.min(61, 630 / rankText.length)} fill={`url(#stat-${id}-${i})`}>
            {i === 0 ? points : rankText}
          </text>
        ) : <>
          <foreignObject x="0" y="68" width={col.w} height="43">
            <div style={{ display: "flex", justifyContent: "center" }}>
              <CardStars count={stars} finish={finish} sizePx={40} gapPx={9} />
            </div>
          </foreignObject>
          <text x={col.w / 2} y="141" textAnchor="middle" fontFamily={FONT} fontWeight="600" fontSize={STARS.captionFontSize}
            letterSpacing="2" fill="#f1f4f7">
            PROSPECT
          </text>
        </>}
      </svg>
    ))}
  </>;
}

export function FooterMark() {
  return (
    <svg data-layer="footer-mark" aria-label="Elite24MVP" className="pointer-events-none absolute" style={zoneStyle(FOOTER)} viewBox="0 0 560 80">
      <text x="280" y="61" textAnchor="middle" fontFamily={FONT} fontSize={FOOTER_FONT_SIZE} fontWeight="900" fontStyle="italic" fill="#e5edf5">
        ELITE<tspan fill={APP_RED}>24</tspan>MVP
      </text>
    </svg>
  );
}
