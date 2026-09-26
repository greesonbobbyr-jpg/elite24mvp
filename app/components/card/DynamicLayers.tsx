"use client";
import { useId } from "react";
import type { Finish } from "@/lib/cardTheme";
import { APP_RED } from "@/lib/cardTheme";

import { NUMBER_ZONE, NUMBER_FONT_SIZE, FIRST_NAME, SURNAME, DETAILS, STAT_RAIL, STAT_COLUMNS, STAT_PANELS, STARS, FOOTER, FOOTER_FONT_SIZE, u, zoneStyle } from "@/lib/cardGeometry";
import { CardStars } from "./CardStars";
const FONT = "var(--font-barlow), sans-serif";

/** Text stays live; a reusable plasma material supplies its foil surface.
 * Separate dark extrusion, fine edge and broad bloom give actual visual depth. */
export function GiantNumber({ text }: { text: string; finish: Finish }) {
  const id = useId().replace(/:/g, "");
  if (!text) return null;
  const glyph = <text x="349" y="540" textAnchor="middle" fontFamily="var(--font-roboto), sans-serif" fontWeight="900" fontSize={NUMBER_FONT_SIZE} textLength="670" lengthAdjust="spacingAndGlyphs">{text}</text>;
  return <svg aria-hidden data-layer="giant-number" className="pointer-events-none absolute overflow-visible" style={zoneStyle(NUMBER_ZONE)} viewBox="0 0 698 550" preserveAspectRatio="none">
    <defs>
      <linearGradient id={`num-${id}`} x1="0" y1="0" x2=".8" y2="1">
        <stop stopColor="#051834" /><stop offset=".25" stopColor="#101b40" /><stop offset=".44" stopColor="#063951" /><stop offset=".57" stopColor="#07172b" /><stop offset=".73" stopColor="#211936" /><stop offset=".88" stopColor="#0a263e" /><stop offset="1" stopColor="#1a3b59" />
      </linearGradient>
      <linearGradient id={`edge-${id}`} x1="0" y1="0" x2=".2" y2="1"><stop stopColor="#fff" /><stop offset=".42" stopColor="#8ae5ff" /><stop offset=".7" stopColor="#e6b2ff" /><stop offset="1" stopColor="#d5faff" /></linearGradient>
      <clipPath id={`numclip-${id}`}>{glyph}</clipPath>
      <filter id={`num-flare-${id}`} x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".045 .08" numOctaves="2" seed="17" result="rough" /><feDisplacementMap in="SourceGraphic" in2="rough" scale="13" xChannelSelector="R" yChannelSelector="G" /><feGaussianBlur stdDeviation=".65" /></filter>
      <filter id={`aura-${id}`} x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="17" /></filter>
      <filter id={`bloom-${id}`} x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="6" /></filter>
    </defs>
    <g transform="translate(3 8)" fill="#030b17" stroke="#031026" strokeWidth="10">{glyph}</g>
    <g fill="none" stroke="#168cff" strokeWidth="24" opacity=".65" filter={`url(#aura-${id})`}>{glyph}</g>
    <g fill="none" stroke="#38aaff" strokeWidth="17" opacity=".9" filter={`url(#bloom-${id})`}>{glyph}</g>
    <g fill={`url(#num-${id})`}>{glyph}</g>
    <image href="/card/finishes/platinum/b3-foil-field.png" x="-100" y="-110" width="900" height="1350" preserveAspectRatio="none" style={{ filter: "brightness(1.5) saturate(1.15)" }} clipPath={`url(#numclip-${id})`} />
    <g fill="none" stroke="#b4f4ff" strokeWidth="2.3" opacity=".8" filter={`url(#num-flare-${id})`}>{glyph}</g>
    <g fill="none" stroke={`url(#edge-${id})`} strokeWidth="8">{glyph}</g>
    <g fill="none" stroke="#f0fdff" strokeWidth="2.6">{glyph}</g>
    <foreignObject x="-10" y="-10" width="720" height="580" clipPath={`url(#numclip-${id})`} style={{ mixBlendMode: "screen", opacity: .12 }}>
      <div style={{ width: "100%", height: "100%", background: "linear-gradient(120deg, transparent 28%, #b4c9ff55 43%, #fff9 47%, #f5b3ff66 52%, transparent 68%)", backgroundSize: "240% 200%", backgroundPosition: "var(--sx, 40%) var(--sy, 32%)" }} />
    </foreignObject>
  </svg>;
}

/** A shared baseline and explicit text widths keep the reference composition
 * stable across names, viewport sizes and font loading. */
export function NameBlock({ firstName, surname, finish }: { firstName: string | null; surname: string; finish: Finish }) {
  const id = useId().replace(/:/g, "");
  const nameLength = surname.length <= 4 ? 430 : 592;
  return <>
    {firstName && <svg data-layer="first-name" aria-label={firstName} className="pointer-events-none absolute overflow-visible" style={zoneStyle(FIRST_NAME.zone)} viewBox="0 0 660 70">
      <defs><linearGradient id={`first-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop stopColor="#effcff" /><stop offset=".35" stopColor="#77d4f1" /><stop offset=".65" stopColor="#147dad" /><stop offset="1" stopColor="#69c5eb" />
      </linearGradient></defs>
      <text x="0" y="59" fontFamily="var(--font-card-display), sans-serif" fontSize={FIRST_NAME.fontSize} transform="translate(10 0) skewX(-12)" fontWeight="700" fontStyle="normal" letterSpacing="6" textLength={Math.min(580, firstName.length * 47)} lengthAdjust="spacingAndGlyphs" fill={`url(#first-${id})`} stroke={finish.metalHighlight} strokeWidth=".8" paintOrder="stroke" style={{ filter: "drop-shadow(1px 2px 1px #001122)" }}>{firstName.toUpperCase()}</text>
    </svg>}
    <svg data-layer="surname" aria-label={surname} className="pointer-events-none absolute overflow-visible" style={zoneStyle(SURNAME.zone)} viewBox="0 0 685 120">
      <defs><linearGradient id={`name-${id}`} x1="0" y1="0" x2=".08" y2="1">
        <stop stopColor="#fcfdff" /><stop offset=".25" stopColor="#f5f6f8" /><stop offset=".45" stopColor="#b8bec5" /><stop offset=".66" stopColor="#383e47" /><stop offset=".88" stopColor="#161d26" /><stop offset="1" stopColor="#626e7c" />
      </linearGradient></defs>
      <text x="23" y="115" fontFamily="var(--font-card-display), sans-serif" fontSize="157" letterSpacing="4" transform="skewX(-12)" fontWeight="700" fontStyle="normal" textLength={nameLength} lengthAdjust="spacingAndGlyphs" fill="#020609" stroke="#010305" strokeWidth="3">{surname.toUpperCase()}</text>
      <text x="21" y="112" fontFamily="var(--font-card-display), sans-serif" fontSize="157" letterSpacing="4" transform="skewX(-12)" fontWeight="700" fontStyle="normal" textLength={nameLength} lengthAdjust="spacingAndGlyphs" fill={`url(#name-${id})`} stroke="#edf6ff" strokeWidth="1.3" paintOrder="stroke">{surname.toUpperCase()}</text>
    </svg>
  </>;
}

export function DetailsLine({ parts }: { parts: (string | null | undefined)[] }) {
  const items = parts.filter((part): part is string => Boolean(part));
  return <svg data-layer="details" aria-label={items.join(" · ")} className="pointer-events-none absolute" style={zoneStyle(DETAILS.zone)} viewBox="0 0 600 62">
    <text x="300" y="42" textAnchor="middle" fontFamily={FONT} fontSize="42" fontWeight="600" fontStyle="normal" letterSpacing="3" textLength="570" lengthAdjust="spacingAndGlyphs" transform="translate(5 0) skewX(-7)" fill="#d2dce5">
      {items.map((part, i) => <tspan key={i}>{i > 0 && <tspan fill="#75dfff"> · </tspan>}<tspan fill={i === 0 ? "#60d8ff" : undefined}>{part.toUpperCase()}</tspan></tspan>)}
    </text>
  </svg>;
}

export function StatRailText({ points, rankText, stars, finish }: { points: number; rankText: string; stars: number; finish: Finish }) {
  const id = useId().replace(/:/g, "");
  return <>{STAT_COLUMNS.map((col, i) => <svg key={i} data-layer={['stat-points', 'stat-rank', 'stat-tier'][i]} className="pointer-events-none absolute overflow-visible" style={{ left: u(col.x), top: u(STAT_RAIL.y), width: u(col.w), height: u(STAT_RAIL.h) }} viewBox={`0 0 ${col.w} ${STAT_RAIL.h}`}>
    <defs><linearGradient id={`stat-${id}-${i}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={i === 0 ? "#c9f9ff" : "#ffffff"} /><stop offset=".5" stopColor={i === 0 ? "#65cfff" : "#c9d1d9"} /><stop offset="1" stopColor={i === 0 ? "#2477ba" : "#f1f4f8"} /></linearGradient></defs>
    <text x={col.w / 2} y="45" textAnchor="middle" fontFamily={FONT} fontWeight="600" fontSize={STAT_PANELS.headerFontSize} letterSpacing="2" fill="#9eeaff">{['POINTS', 'LEADERBOARD', 'TIER'][i]}</text>
    {i < 2 ? <text x={col.w / 2} y="129" textAnchor="middle" fontFamily={FONT} fontWeight="900" fontSize={i === 0 ? Math.min(82, 370 / String(points).length) : Math.min(61, 630 / rankText.length)} fill={`url(#stat-${id}-${i})`}>{i === 0 ? points : rankText}</text> : <>
      <foreignObject x="0" y="68" width={col.w} height="43"><div style={{ display: "flex", justifyContent: "center" }}><CardStars count={stars} finish={finish} sizePx={40} gapPx={9} /></div></foreignObject>
      <text x={col.w / 2} y="141" textAnchor="middle" fontFamily={FONT} fontWeight="600" fontSize={STARS.captionFontSize} letterSpacing="2" fill="#f1f4f7">PROSPECT</text>
    </>}
  </svg>)}</>;
}

export function FooterMark() {
  return <svg data-layer="footer-mark" aria-label="Elite24MVP" className="pointer-events-none absolute" style={zoneStyle(FOOTER)} viewBox="0 0 560 80">
    <text x="280" y="61" textAnchor="middle" fontFamily={FONT} fontSize={FOOTER_FONT_SIZE} fontWeight="900" fontStyle="italic" fill="#e5edf5">ELITE<tspan fill={APP_RED}>24</tspan>MVP</text>
  </svg>;
}













