// THE CARD GEOMETRY SPEC (Δ2/Δ4) — the single authoritative layout definition
// for the Full Player Card. Every zone is expressed in the card's own
// NORMALIZED coordinate system: x/w as a fraction of card WIDTH, y/h as a
// fraction of card HEIGHT (0–1). Components consume these constants; no
// critical dimension may live in scattered CSS.
//
// TWO RULES THIS FILE ENFORCES:
//   1. A prospect-level (finish) change may only ever select finish tokens in
//      lib/cardTheme.ts — it must NEVER read different geometry. There is one
//      card; only the material changes.
//   2. ★ GEOMETRY LOCKED ★ — until that milestone (human visual approval of
//      the 4-star Platinum master against the reference overlay) every value
//      here is PROVISIONAL and calibrated during the loop. After the lock,
//      values are frozen; changing one is a design decision, not a tweak.
//
// STATUS: PROVISIONAL — geometry not yet locked.

export const GEOMETRY_LOCKED = false;

/** A rectangular zone in normalized card coordinates. */
export type Zone = { x: number; y: number; w: number; h: number };

// ---- card bounds -----------------------------------------------------------

/** Trading-card portrait ratio (width / height) — 2.5" × 3.5". */
export const CARD_ASPECT = 2.5 / 3.5;

/** Reference render width in px at 1x; height derives from CARD_ASPECT. */
export const BASE_WIDTH = 340;

/** Corner radius as a fraction of card width. */
export const CORNER_RADIUS = 0.055;

// ---- frame -----------------------------------------------------------------

/** Chamfered metal frame thickness (fraction of card WIDTH, all sides). */
export const FRAME = {
  thickness: 0.03,
  /** Inner bevel line inset from the frame's inner edge. */
  bevel: 0.008,
  /** Corner chamfer length along each edge. */
  chamfer: 0.09,
};

/** Inner safe area — everything except the frame. */
export const SAFE: Zone = {
  x: FRAME.thickness,
  y: FRAME.thickness * CARD_ASPECT,
  w: 1 - FRAME.thickness * 2,
  h: 1 - FRAME.thickness * CARD_ASPECT * 2,
};

// ---- top corners -----------------------------------------------------------

/** TEAM LOGO safe zone — top-LEFT (owner ruling). Logos contain-fit here. */
export const LOGO_ZONE: Zone = { x: 0.06, y: 0.04, w: 0.17, h: 0.115 };

/**
 * TOP-RIGHT slot — intentionally EMPTY (Δ10). Architecturally reserved as a
 * configurable slot; the slot component renders nothing today.
 */
export const TOP_RIGHT_SLOT: Zone = { x: 0.77, y: 0.04, w: 0.17, h: 0.115 };

// ---- giant background number ----------------------------------------------

/**
 * The GIANT NUMBER occupies the upper half behind the athlete. Single digits
 * render with a leading zero ("07") in this zone only — the details line
 * stays un-padded ("#7").
 */
export const NUMBER_ZONE: Zone = { x: 0.1, y: 0.055, w: 0.8, h: 0.47 };

/** Number font-size as a fraction of card height (condensed athletic face). */
export const NUMBER_SIZE = 0.34;

// ---- portrait safe zone ----------------------------------------------------

/**
 * PORTRAIT SAFE ZONE — where the normalized cutout athlete lives. The Stage-4
 * normalizer transforms every photo so the eyes/head/shoulders land on these
 * targets; the photo is fitted to the card, never the card to the photo.
 */
export const PORTRAIT = {
  /** Bounding zone for any visible cutout pixel. */
  zone: { x: 0.06, y: 0.1, w: 0.88, h: 0.58 } as Zone,
  /** Target eye-line Y. */
  eyeY: 0.275,
  /** Target top-of-head Y (hair included). */
  headTopY: 0.14,
  /** Target shoulder-line Y. */
  shoulderY: 0.475,
  /** Max athlete width (shoulder span may not exceed this). */
  maxW: 0.84,
  /** Hard bottom limit — torso fades out above the name block. */
  bottomY: 0.68,
  /** Horizontal center of the athlete. */
  centerX: 0.5,
};

// ---- name block ------------------------------------------------------------

/** First name — smaller, team-accent, above the surname. */
export const FIRST_NAME = {
  y: 0.6,
  size: 0.032, // fraction of card height
  tracking: "0.14em",
};

/**
 * SURNAME — the dominant line. Deterministic text fitting: size shrinks with
 * length between max and min; never wraps, never touches the frame.
 */
export const SURNAME = {
  y: 0.665,
  maxSize: 0.075,
  minSize: 0.048,
  /** Character count at/below which maxSize applies. */
  fitStart: 7,
  /** Character count at/above which minSize applies. */
  fitEnd: 14,
  maxW: 0.86,
};

/** Details line: `#22 · COMBO GUARD · 6'4"`. */
export const DETAILS = {
  y: 0.72,
  size: 0.026,
  tracking: "0.12em",
};

// ---- stat bar --------------------------------------------------------------

/** The three-panel stat bar: POINTS · LEADERBOARD · TIER. */
export const STAT_BAR: Zone = { x: 0.06, y: 0.765, w: 0.88, h: 0.115 };

/** Per-panel boxes inside the stat bar (fractions of the STAT_BAR zone). */
export const STAT_PANELS = {
  gap: 0.025, // gap between panels as fraction of stat-bar width
  headerSize: 0.019, // label font-size, fraction of CARD height
  valueSize: 0.042, // value font-size, fraction of CARD height
};

/**
 * Star group box (inside the TIER panel): earned stars only, centered,
 * growing outward. Star size + gap in card-height fractions.
 */
export const STARS = {
  size: 0.026,
  gap: 0.008,
  /** "PROSPECT" caption below the stars. */
  captionSize: 0.017,
};

// ---- footer ----------------------------------------------------------------

/** ELITE24MVP maker's-mark footer tab. */
export const FOOTER: Zone = { x: 0.3, y: 0.9, w: 0.4, h: 0.052 };
export const FOOTER_TEXT_SIZE = 0.024;

// ---- helpers ---------------------------------------------------------------

/** CSS absolute-position styles for a zone (percent-based). */
export function zoneStyle(z: Zone): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
  return { left: pct(z.x), top: pct(z.y), width: pct(z.w), height: pct(z.h) };
}

/**
 * Deterministic surname fitting — font-size (fraction of card height) from
 * name length. Clamped linear interpolation; no measurement, no reflow.
 */
export function surnameSize(name: string): number {
  const n = name.length;
  if (n <= SURNAME.fitStart) return SURNAME.maxSize;
  if (n >= SURNAME.fitEnd) return SURNAME.minSize;
  const t = (n - SURNAME.fitStart) / (SURNAME.fitEnd - SURNAME.fitStart);
  return SURNAME.maxSize + (SURNAME.minSize - SURNAME.maxSize) * t;
}

/**
 * The giant-number string: leading zero for single digits ("07"); two-digit
 * numbers unchanged. The details line must NOT use this (it stays "#7").
 */
export function giantNumber(jersey: number | string | null | undefined): string {
  if (jersey == null || jersey === "") return "";
  const s = String(jersey).replace(/\D/g, "");
  if (!s) return "";
  return s.length === 1 ? `0${s}` : s;
}
