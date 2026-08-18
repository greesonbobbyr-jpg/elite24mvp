"use client";

import type { Finish, TeamAccent } from "@/lib/cardTheme";
import { APP_RED, withAlpha } from "@/lib/cardTheme";
import {
  NUMBER_ZONE,
  NUMBER_FONT_SIZE,
  FIRST_NAME,
  SURNAME,
  DETAILS,
  STAT_RAIL,
  STAT_PANELS,
  STARS,
  FOOTER,
  FOOTER_FONT_SIZE,
  u,
  zoneStyle,
  surnameSize,
} from "@/lib/cardGeometry";
import { CardStars } from "./CardStars";

// DYNAMIC PLAYER/DATA LAYERS of the compositor (Plan v4 §4.5). Every position
// and size comes from lib/cardGeometry in master units via `--u`; the finish
// supplies MATERIAL (number/star material family), the team supplies the
// environmental first-name accent — never merged.

const DISPLAY_FONT = "var(--font-barlow)";

/** Layer 13 — the GIANT NUMBER: solid metallic material text, behind the player. */
export function GiantNumber({ text, finish }: { text: string; finish: Finish }) {
  if (!text) return null;
  const hi = finish.metalHighlight;
  return (
    <div
      aria-hidden
      data-layer="giant-number"
      className="pointer-events-none absolute flex select-none items-start justify-center"
      style={zoneStyle(NUMBER_ZONE)}
    >
      <span
        className="font-black italic leading-none"
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: u(NUMBER_FONT_SIZE),
          letterSpacing: "-0.05em",
          lineHeight: 0.8,
          color: "transparent",
          // The number's MATERIAL: the finish's metal family, dark body →
          // bright cap. Solid, not an alpha ghost.
          backgroundImage: `linear-gradient(180deg, ${withAlpha(hi, 0.85)} 0%, ${withAlpha(hi, 0.55)} 30%, ${withAlpha(
            finish.metalShadow,
            0.9,
          )} 62%, ${withAlpha(hi, 0.4)} 100%)`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextStrokeWidth: u(3),
          WebkitTextStrokeColor: withAlpha(hi, 0.7),
          filter: `drop-shadow(0 0 ${u(18)} ${withAlpha(finish.lightHue, 0.35 * finish.lightIntensity)})`,
        }}
      >
        {text}
      </span>
    </div>
  );
}

/** Layer 8 — first name (team accent) + dominant metallic surname (Δ13). */
export function NameBlock({
  firstName,
  surname,
  team,
}: {
  firstName: string | null;
  surname: string;
  team: TeamAccent;
}) {
  return (
    <>
      {firstName && (
        <p
          data-layer="first-name"
          className="pointer-events-none absolute flex items-end justify-center font-bold uppercase leading-none"
          style={{
            ...zoneStyle(FIRST_NAME.zone),
            fontFamily: DISPLAY_FONT,
            fontStyle: "italic",
            fontSize: u(FIRST_NAME.fontSize),
            letterSpacing: FIRST_NAME.tracking,
            color: team.text,
            textShadow: `0 ${u(2)} ${u(10)} rgba(0,0,0,0.75)`,
            whiteSpace: "nowrap",
          }}
        >
          {firstName}
        </p>
      )}
      <div
        data-layer="surname"
        className="pointer-events-none absolute flex items-start justify-center"
        style={{
          ...zoneStyle(SURNAME.zone),
          fontFamily: DISPLAY_FONT,
          fontSize: u(surnameSize(surname)),
          lineHeight: 0.92,
          whiteSpace: "nowrap",
        }}
      >
        <span className="relative font-black uppercase italic">
          {/* depth copy */}
          <span
            aria-hidden
            className="absolute inset-0"
            style={{ transform: `translateY(${u(5)})`, color: "rgba(0,0,0,0.65)" }}
          >
            {surname}
          </span>
          {/* metallic material — restrained, tilt-responsive highlight; no rainbow */}
          <span
            className="relative"
            style={{
              color: "transparent",
              backgroundImage:
                "linear-gradient(180deg, #ffffff 0%, #eef2f6 40%, #a9b4c1 54%, #e6ecf2 72%, #cbd3dc 100%)",
              backgroundSize: "100% 200%",
              backgroundPositionY: "calc(var(--sy, 32%) * 0.25)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              filter: `drop-shadow(0 ${u(1)} ${u(2)} rgba(0,0,0,0.6))`,
            }}
          >
            {surname}
          </span>
        </span>
      </div>
    </>
  );
}

/** Layer 8b — details line, `#7 · COMBO GUARD · 6'4"` (never zero-padded). */
export function DetailsLine({ parts }: { parts: (string | null | undefined)[] }) {
  const text = parts.filter(Boolean).join(" · ");
  if (!text) return null;
  return (
    <p
      data-layer="details"
      className="pointer-events-none absolute flex items-center justify-center font-bold uppercase"
      style={{
        ...zoneStyle(DETAILS.zone),
        fontFamily: DISPLAY_FONT,
        fontStyle: "italic",
        fontSize: u(DETAILS.fontSize),
        letterSpacing: DETAILS.tracking,
        color: "rgba(255,255,255,0.86)",
        textShadow: `0 ${u(1)} ${u(6)} rgba(0,0,0,0.7)`,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </p>
  );
}

/**
 * Layer 6 — stat-rail TYPOGRAPHY + earned stars only. The panel CHASSIS is
 * authored art (chassis.webp / chassis-fg.webp); nothing here draws a box.
 */
export function StatRailText({
  points,
  rankText,
  stars,
  finish,
}: {
  points: number;
  rankText: string;
  stars: number;
  finish: Finish;
}) {
  const panelW = (STAT_RAIL.w - STAT_PANELS.gap * 2) / 3;
  const panelX = (i: number) => STAT_RAIL.x + i * (panelW + STAT_PANELS.gap);
  const header = (label: string) => (
    <span
      className="absolute left-0 right-0 text-center font-bold uppercase"
      style={{
        top: u(STAT_PANELS.headerY),
        transform: "translateY(-100%)",
        fontSize: u(STAT_PANELS.headerFontSize),
        letterSpacing: STAT_PANELS.headerTracking,
        color: withAlpha(finish.metalHighlight, 0.7),
      }}
    >
      {label}
    </span>
  );
  const value = (text: string) => (
    <span
      className="absolute left-0 right-0 text-center font-black tabular-nums leading-none text-white"
      style={{
        top: u(STAT_PANELS.valueY),
        transform: "translateY(-100%)",
        fontFamily: DISPLAY_FONT,
        fontStyle: "italic",
        fontSize: u(STAT_PANELS.valueFontSize),
        textShadow: `0 ${u(2)} ${u(6)} rgba(0,0,0,0.7)`,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
  const panelStyle = (i: number) => ({
    left: u(panelX(i)),
    top: u(STAT_RAIL.y),
    width: u(panelW),
    height: u(STAT_RAIL.h),
  });

  return (
    <>
      <div data-layer="stat-points" className="pointer-events-none absolute" style={panelStyle(0)}>
        {header("Points")}
        {value(String(points))}
      </div>
      <div data-layer="stat-rank" className="pointer-events-none absolute" style={panelStyle(1)}>
        {header("Leaderboard")}
        {value(rankText)}
      </div>
      <div data-layer="stat-tier" className="pointer-events-none absolute" style={panelStyle(2)}>
        {header("Tier")}
        <span
          className="absolute left-0 right-0 flex justify-center"
          style={{ top: u(STARS.rowY), transform: "translateY(-50%)" }}
        >
          <CardStars count={stars} finish={finish} sizeUnits={STARS.size} gapUnits={STARS.gap} />
        </span>
        <span
          className="absolute left-0 right-0 text-center font-bold uppercase text-white/85"
          style={{
            top: u(STARS.captionY),
            transform: "translateY(-100%)",
            fontSize: u(STARS.captionFontSize),
            letterSpacing: STARS.captionTracking,
          }}
        >
          Prospect
        </span>
      </div>
    </>
  );
}

/** Layer 5 — ELITE24MVP maker's-mark typography over the authored footer chassis. */
export function FooterMark() {
  return (
    <div
      data-layer="footer-mark"
      className="pointer-events-none absolute flex items-center justify-center"
      style={zoneStyle(FOOTER)}
    >
      <span
        className="font-black italic uppercase leading-none text-white"
        style={{
          fontFamily: DISPLAY_FONT,
          fontSize: u(FOOTER_FONT_SIZE),
          letterSpacing: "0.02em",
          textShadow: `0 ${u(1)} ${u(4)} rgba(0,0,0,0.7)`,
        }}
      >
        Elite<span style={{ color: APP_RED }}>24</span>MVP
      </span>
    </div>
  );
}
