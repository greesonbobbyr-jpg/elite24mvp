// THE CARD GEOMETRY SPEC (Plan v4 §4.1/§4.4) — the ONE geometry source of truth
// for the Full Player Card, in the 1000 × 1500 INTEGER DESIGN-UNIT master
// coordinate system: x 0–1000, y 0–1500. Rendering scales units proportionally
// via the `--u` CSS variable (1 unit = calc(var(--u))); nothing reflows and no
// layout engine may independently move a part. Components consume units only —
// no critical Full-Card dimension may live in scattered CSS. (Compact / wide /
// avatar are separate compositions and carry their own local geometry.)
//
// AUTHORITY (v4 clarification 1):
//   APPROVED VISUAL REFERENCE → HUMAN VISUAL JUDGMENT → these PROVISIONAL units
//   → ★ GEOMETRY LOCKED ★
// Every value here is a PROVISIONAL CALIBRATION TARGET transcribed from the
// design-reference handoff. If a value conflicts visually with the approved
// reference, the value changes — never the card. Only after human approval of
// the Platinum master do these coordinates become authoritative and frozen.
//
// TWO RULES:
//   1. A prospect-level (finish) change may only ever select finish tokens /
//      finish assets — it must NEVER read different geometry.
//   2. Team identity never touches geometry either (it is environmental).
//
// STATUS: PROVISIONAL — geometry not yet locked.

export const GEOMETRY_LOCKED = false;

/** Master design-unit canvas. */
export const MASTER_W = 1000;
export const MASTER_H = 1500;

/** Card aspect (width / height) — the 1000×1500 master. */
export const CARD_ASPECT = MASTER_W / MASTER_H;

/** Default rendered width in CSS px when a caller gives no width. */
export const DEFAULT_WIDTH_PX = 340;

/** A rectangular zone in master units. */
export type Zone = { x: number; y: number; w: number; h: number };

// ---- reference overlay -----------------------------------------------------

/**
 * Where the card sits inside the approved reference screenshot
 * (design-reference/elite24mvp-player-card/elite24mvp-approved-card-reference.png,
 * 726×742 px) — MEASURED from the bright frame silhouette so the overlay can
 * align that region to the master stage. NOTE: the measured region is ~0.60
 * wide:tall, narrower than the 1000×1500 master (0.667) — a checkpoint
 * question for human review, not something the renderer resolves.
 */
export const REFERENCE_CROP = { x: 202, y: 80, w: 343, h: 571 };

// ---- safe areas -----------------------------------------------------------

/**
 * Inner safe area. Handoff states x 72–828 / y 82–1418; the x-range is
 * asymmetric and treated as a transcription of 72–928 (±72). Overlay decides.
 */
export const SAFE: Zone = { x: 72, y: 82, w: 856, h: 1336 };

/** TEAM LOGO safe zone — top-LEFT (owner ruling). Contain-fit, alpha-trim (Δ9). */
export const LOGO_ZONE: Zone = { x: 100, y: 150, w: 180, h: 180 };

/**
 * TOP-RIGHT slot — intentionally EMPTY (Δ10). Mirrors the logo zone's visual
 * weight; the slot component renders nothing. No Player ID, no filler.
 */
export const TOP_RIGHT_SLOT: Zone = { x: 720, y: 150, w: 180, h: 180 };

// ---- giant background number ----------------------------------------------

/**
 * The GIANT NUMBER — enormous, behind the athlete, naturally occluded by the
 * cutout. Single digits render with a leading zero ("07") here only; the
 * details line stays un-padded ("#7").
 */
export const NUMBER_ZONE: Zone = { x: 80, y: 265, w: 685, h: 835 };

/** Giant-number font size in units (condensed athletic face; calibrated in the loop). */
export const NUMBER_FONT_SIZE = 1000;

// ---- portrait target zone -------------------------------------------------

/**
 * PORTRAIT TARGET — where the normalized cutout athlete lives. The Stage-4
 * normalizer transforms every photo so eyes/head/shoulders land on these
 * targets; the photo is fitted to the card, never the card to the photo.
 */
export const PORTRAIT = {
  /** Bounding zone for any visible cutout pixel. */
  zone: { x: 155, y: 235, w: 690, h: 1005 } as Zone,
  /** Target eye-line Y (handoff/map: ≈545). */
  eyeY: 545,
  /** Target top-of-head Y (hair included). */
  headTopY: 300,
  /** Target shoulder-line Y. */
  shoulderY: 850,
  /** Max athlete width (shoulder span may not exceed this). */
  maxW: 690,
  /** Hard bottom limit — torso ends above/behind the name block. */
  bottomY: 1240,
  /** Horizontal center of the athlete. */
  centerX: 500,
};

// ---- name block ------------------------------------------------------------

/** First name — smaller, team-accent, above the surname. */
export const FIRST_NAME = {
  zone: { x: 110, y: 935, w: 680, h: 70 } as Zone,
  fontSize: 52,
  tracking: "0.14em",
};

/**
 * SURNAME — the dominant line, metallic. Deterministic text fitting: size
 * shrinks with length between max and min; never wraps, never touches the frame.
 */
export const SURNAME = {
  zone: { x: 110, y: 1005, w: 680, h: 110 } as Zone,
  maxFontSize: 118,
  minFontSize: 76,
  /** Character count at/below which maxFontSize applies. */
  fitStart: 7,
  /** Character count at/above which minFontSize applies. */
  fitEnd: 14,
};

/** Details line: `#22 · COMBO GUARD · 6'4"`. */
export const DETAILS = {
  zone: { x: 110, y: 1120, w: 680, h: 65 } as Zone,
  fontSize: 40,
  tracking: "0.12em",
};

// ---- stat rail --------------------------------------------------------------

/**
 * The three-panel stat rail: POINTS · LEADERBOARD · TIER. The panel CHASSIS is
 * authored art; only typography + stars render here, positioned into the
 * three equal panel openings.
 */
export const STAT_RAIL: Zone = { x: 90, y: 1200, w: 820, h: 180 };

export const STAT_PANELS = {
  /** Gap between the three equal panels, in units. */
  gap: 20,
  headerFontSize: 26,
  headerTracking: "0.18em",
  valueFontSize: 62,
  /** Vertical offset of the header baseline inside a panel. */
  headerY: 38,
  /** Vertical offset of the value baseline inside a panel. */
  valueY: 128,
};

/** Star group inside the TIER panel: earned stars only, centered, growing outward. */
export const STARS = {
  size: 40,
  gap: 10,
  /** Y (inside the panel) of the star row center. */
  rowY: 84,
  captionFontSize: 22,
  captionTracking: "0.3em",
  captionY: 150,
};

// ---- footer ----------------------------------------------------------------

/** ELITE24MVP maker's-mark typography over the authored footer chassis. */
export const FOOTER: Zone = { x: 90, y: 1395, w: 820, h: 75 };
export const FOOTER_FONT_SIZE = 44;

// ---- helpers ---------------------------------------------------------------

/** `calc(var(--u) * n)` — n master units in the current render scale. */
export function u(n: number): string {
  return `calc(var(--u) * ${n})`;
}

/** Absolute-position styles for a zone, in units. */
export function zoneStyle(z: Zone): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  return { left: u(z.x), top: u(z.y), width: u(z.w), height: u(z.h) };
}

/** Percent-based zone (for layers that need %, e.g. masks/gradients). */
export function zonePct(z: Zone): { left: string; top: string; width: string; height: string } {
  const px = (v: number) => `${((v / MASTER_W) * 100).toFixed(3)}%`;
  const py = (v: number) => `${((v / MASTER_H) * 100).toFixed(3)}%`;
  return { left: px(z.x), top: py(z.y), width: px(z.w), height: py(z.h) };
}

/** Fraction-of-card-height for a Y unit (used by the portrait normalizer). */
export const fy = (yUnits: number) => yUnits / MASTER_H;
/** Fraction-of-card-width for an X unit. */
export const fx = (xUnits: number) => xUnits / MASTER_W;

/**
 * Deterministic surname fitting — font size in units from name length.
 * Clamped linear interpolation; no measurement, no reflow.
 */
export function surnameSize(name: string): number {
  const n = name.length;
  if (n <= SURNAME.fitStart) return SURNAME.maxFontSize;
  if (n >= SURNAME.fitEnd) return SURNAME.minFontSize;
  const t = (n - SURNAME.fitStart) / (SURNAME.fitEnd - SURNAME.fitStart);
  return SURNAME.maxFontSize + (SURNAME.minFontSize - SURNAME.maxFontSize) * t;
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
