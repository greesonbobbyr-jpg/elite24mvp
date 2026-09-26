// Color + tier logic for the PlayerCard. Pure functions, no DB. The whole card
// scheme derives from a team's primaryColor + secondaryColor; if a team has no
// colors yet, everything falls back to the app's red/black. Readability is a
// hard guardrail: text always sits on a darkened zone, never colored-on-colored,
// so these helpers only ever produce DARK card bases + return a scrim to layer
// behind text.

import { derivePalette, LEVEL_LOOKS } from "./finishArt";

export const APP_RED = "#e1102a";
const APP_RED_DEEP = "#7a0a18";

// ---- hex helpers ----------------------------------------------------------

type RGB = { r: number; g: number; b: number };

export function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHex({ r, g, b }: RGB): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
    .toString(16)
    .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

// Lighten (pct > 0, toward white) or darken (pct < 0, toward black) a hex.
export function shade(hex: string, pct: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const t = pct < 0 ? 0 : 255;
  const p = Math.abs(pct);
  return toHex({
    r: rgb.r + (t - rgb.r) * p,
    g: rgb.g + (t - rgb.g) * p,
    b: rgb.b + (t - rgb.b) * p,
  });
}

export function withAlpha(hex: string, a: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

// Relative luminance (0 dark → 1 light), sRGB-weighted. Used to darken light
// team colors harder so a card never reads as a "light" card.
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
}

// ---- card colors ----------------------------------------------------------

// The card's background: a rich diagonal built FROM the primary — deep shade at
// top, vivid mid, darkest at the bottom edge — plus a soft top glow. Light
// primaries get darkened harder so text zones stay readable. No primary → the
// app red/black fallback.
export function cardGradient(primary?: string | null): string {
  let base = primary && hexToRgb(primary) ? primary : APP_RED;
  const isFallback = !(primary && hexToRgb(primary));

  // Mirror of the light-color guard below: a near-black team primary would melt
  // into the black app background, so lift very dark bases into a visible
  // charcoal before building the gradient.
  const rawLum = luminance(base);
  if (!isFallback && rawLum < 0.09) {
    base = shade(base, 0.12 + (0.09 - rawLum) * 2);
  }

  // Extra darkening for light colors (cream/white/silver) so the card body is
  // never bright behind content.
  const lift = Math.max(0, luminance(base) - 0.45); // 0 for dark, up to ~0.55
  const topDark = -(0.42 + lift * 0.45);
  const midDark = isFallback ? -0.18 : -(0.06 + lift * 0.5);
  const botDark = -(0.68 + lift * 0.25);

  const top = shade(base, topDark);
  const mid = shade(base, midDark);
  const bot = isFallback ? "#120306" : shade(base, botDark);

  // Layered for depth (front → back; translucent overlays first, the opaque base
  // diagonal LAST so it shows through). All derived from `base` — no hardcoding:
  //  1. a hot radial glow up top (lightened primary),
  //  2. a soft diagonal sheen band (the .e24-surface material feel),
  //  3. a corner vignette that darkens the edges,
  //  4. the opaque team-color diagonal base.
  const hot = shade(base, 0.4 + lift * 0.2);
  const sheen = withAlpha(shade(base, 0.6), 0.12);
  const glow = withAlpha(hot, 0.6);

  return (
    `radial-gradient(95% 62% at 50% -6%, ${glow} 0%, ${withAlpha(hot, 0)} 58%),` +
    `linear-gradient(105deg, ${sheen} 0%, ${withAlpha(base, 0)} 44%),` +
    `radial-gradient(135% 115% at 50% 42%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.5) 100%),` +
    `linear-gradient(160deg, ${top} 0%, ${mid} 46%, ${bot} 100%)`
  );
}

// The accent (trim, jersey number, rank ring): secondary if set, else a
// lightened primary, else app red. Kept bright enough to pop on the dark card.
export function accentColor(
  primary?: string | null,
  secondary?: string | null,
): string {
  if (secondary && hexToRgb(secondary)) return secondary;
  if (primary && hexToRgb(primary)) return shade(primary, 0.35);
  return APP_RED;
}

// The jersey-number color = the team SECONDARY (its designated accent), nudged
// lighter only if it's too dark to stay legible on the dark card face. Falls back
// to the same accent as everything else when there's no secondary.
export function numberColor(
  primary?: string | null,
  secondary?: string | null,
): string {
  const c = accentColor(primary, secondary);
  const lum = luminance(c);
  return lum < 0.42 ? shade(c, 0.42 - lum) : c;
}

// A darkened accent for the fallback deep tone.
export { APP_RED_DEEP };

// Dark scrim layered behind any text zone — the readability guardrail.
export const SCRIM = "rgba(0,0,0,0.42)";

// A bottom vignette so the name/stat area is always on darkness regardless of
// how light the team primary is.
export const BOTTOM_VIGNETTE =
  "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.35) 34%, rgba(0,0,0,0) 62%)";

// ---- tiers ----------------------------------------------------------------

export type TierKey =
  | "prospect"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum";

export type Tier = {
  key: TierKey;
  label: string;
  min: number;
  // Metallic conic stops (dark base → bright highlight → mid → dark) for the
  // solid, beveled border frame — reads as shined metal, not a flat color.
  ring: string[];
  glow: string | null; // outer glow color (raised look), or null
  glint: number; // light-sweep / edge-glint intensity 0..1 (higher tier = stronger)
  sweepSec: number; // sweep duration in seconds (0 = no sweep, e.g. Prospect)
};

// OWNER-LOCKED thresholds (card redesign): 0 / 1k / 5k / 20k / 50k career
// points. Deliberately NOT easy — the top level ≈ seasons of daily max effort.
// Single source of truth; re-tune here only. (Legacy ring/glow/glint fields
// survive for the pre-redesign card until Stages 5–7 replace their consumers.)
export const TIERS: Tier[] = [
  {
    key: "prospect",
    label: "Prospect",
    min: 0,
    // Near-matte dark edge — barely metallic, no sweep.
    ring: ["#24272b", "#383d43", "#2c3036", "#20242a"],
    glow: null,
    glint: 0,
    sweepSec: 0,
  },
  {
    key: "bronze",
    label: "Bronze",
    min: 1000,
    // deep bronze → bright copper → brown
    ring: ["#3f2410", "#7a4a20", "#d98f4e", "#f0b877", "#9a5f2c", "#3f2410"],
    glow: "rgba(200,120,60,0.35)",
    glint: 0.14,
    sweepSec: 6,
  },
  {
    key: "silver",
    label: "Silver",
    min: 5000,
    // charcoal → white-hot → grey
    ring: ["#2f3236", "#6b7178", "#c9ced6", "#ffffff", "#8b9199", "#2f3236"],
    glow: "rgba(210,220,230,0.30)",
    glint: 0.2,
    sweepSec: 5.5,
  },
  {
    key: "gold",
    label: "Gold",
    min: 20000,
    // dark gold/amber → pale-gold highlight → dark gold
    ring: ["#4d3608", "#997012", "#e6b73a", "#fff1b0", "#b98f1e", "#4d3608"],
    glow: "rgba(230,183,58,0.45)",
    glint: 0.26,
    sweepSec: 5,
  },
  {
    key: "platinum",
    label: "Platinum",
    min: 50000,
    // iridescent cool blue / violet / silver shift
    ring: [
      "#2f5a72",
      "#5ac6dc",
      "#9fb2ff",
      "#e9d6ff",
      "#ffffff",
      "#8affd6",
      "#6f9bff",
      "#2f5a72",
    ],
    glow: "rgba(150,210,255,0.5)",
    glint: 0.34,
    sweepSec: 4.5,
  },
];

export function tierForPoints(points: number): Tier {
  let match = TIERS[0];
  for (const t of TIERS) if (points >= t.min) match = t;
  return match;
}

export function tierByKey(key: TierKey): Tier {
  return TIERS.find((t) => t.key === key) ?? TIERS[0];
}

// ---- stars (card redesign) -------------------------------------------------

/**
 * Star count for the card's TIER panel: 1–5, one per tier level reached.
 * EARNED STARS ONLY — the card renders exactly this many; never hollow, dim,
 * or locked placeholder stars.
 */
export function starsForPoints(points: number): 1 | 2 | 3 | 4 | 5 {
  const idx = TIERS.findIndex((t) => t.key === tierForPoints(points).key);
  return (idx + 1) as 1 | 2 | 3 | 4 | 5;
}

// ---- finish tokens (card redesign, Δ2/Δ4) ----------------------------------
//
// The SECOND token system: material finishes. Geometry lives in
// lib/cardGeometry.ts and never varies by level; a prospect-level change may
// only ever select one of these finish token sets. The metal names below are
// INTERNAL ONLY — they never print on the card (the card shows stars +
// "PROSPECT"; tier display labels stay in TIERS above).

export type FinishKey = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export type Finish = {
  /** Internal token name — never rendered as text on the card. */
  key: FinishKey;
  /** Star count this finish corresponds to (1–5). */
  stars: 1 | 2 | 3 | 4 | 5;
  /** Conic metal colorway for the frame (dark → highlight → mid → dark). */
  metal: string[];
  /** Brightest metal tone — star fill, number stroke highlights. */
  metalHighlight: string;
  /** Darkest metal tone — bevel shadows. */
  metalShadow: string;
  /** Card-face environment: dark foundation gradient stops. */
  background: { top: string; mid: string; bottom: string };
  /** Lighting hue for backlight (layer 1) + rim (layer 2) + spill (layer 3). */
  lightHue: string;
  /** Overall lighting strength 0..1. */
  lightIntensity: number;
  /**
   * Foil/spectral strength 0..1 — the progression is sacred (each level up
   * must read as strictly more premium); exact numbers tunable in the loop.
   */
  foilIntensity: number;
  /** Spectral gradient stops for the foil sweep (card surfaces only — Δ13). */
  spectral: string[];
  /** Star SVG fill gradient (the finish's metal). */
  starMaterial: { from: string; to: string };
  /** Colors of the live layers, matched to this level's authored art. */
  palette: FinishPalette;
};

/** The live layers' colors (number, text accents, energy, frame sheen). */
export type FinishPalette = {
  number: {
    /** Dark body under the foil, top-left → bottom-right. */
    body: string[];
    /** Offset extrusion: fill and stroke. */
    extrude: string;
    extrudeEdge: string;
    /** Wide aura and tight bloom behind the glyphs. */
    aura: string;
    bloom: string;
    /** Broken spark line, bevel gradient and hairline core. */
    flare: string;
    edge: string[];
    core: string;
    /** Moving sheen band inside the glyphs. */
    sheen: string[];
  };
  /** First-name gradient (top → bottom) and its shadow. */
  firstName: string[];
  firstNameShadow: string;
  /** Details line: the jersey number and the separators. */
  accent: string;
  separator: string;
  /** Stat panel headers and the points value gradient. */
  statHeader: string;
  statValue: string[];
  energy: {
    /** How strongly the energy leaves the player (0 none … 1 Platinum). */
    strength: number;
    /** Bloom where the energy meets the shoulders; root glow, center → edge. */
    contact: string;
    glow: string[];
    /** Shoulder sparks: glow stroke, shard fill, shard glow, arc line. */
    sparks: string[];
    /** Rim light flecks and hairline. */
    rimFoil: string;
    rimCore: string;
  };
  /** Frame sheen: the light spot and the diagonal band. */
  frameSheen: { spot: string[]; band: string[] };
  /** Depth shadow behind the player. */
  shadow: string;
};

/** Platinum's live-layer colors, exactly as approved (2026-09-26). */
export const PLATINUM_PALETTE: FinishPalette = {
  number: {
    body: ["#051834", "#101b40", "#063951", "#07172b", "#211936", "#0a263e", "#1a3b59"],
    extrude: "#030b17",
    extrudeEdge: "#031026",
    aura: "#168cff",
    bloom: "#38aaff",
    flare: "#b4f4ff",
    edge: ["#fff", "#8ae5ff", "#e6b2ff", "#d5faff"],
    core: "#ffffff",
    sheen: ["#b4c9ff55", "#fff9", "#f5b3ff66"],
  },
  firstName: ["#effcff", "#77d4f1", "#147dad", "#69c5eb"],
  firstNameShadow: "#001122",
  accent: "#60d8ff",
  separator: "#75dfff",
  statHeader: "#9eeaff",
  statValue: ["#c9f9ff", "#65cfff", "#2477ba"],
  energy: {
    strength: 1,
    contact: "#5cc8ff",
    glow: ["#ffffff", "#9fe2ff", "#1a8cff"],
    sparks: ["#009cff", "#d1f6ff", "#149dff", "#b6f1ff"],
    rimFoil: "#bcefff",
    rimCore: "#d7f7ff",
  },
  frameSheen: { spot: ["#fff", "#b8efff60"], band: ["#88e8ff25", "#f7caff80", "#ffffffa0", "#85e9ff40"] },
  shadow: "#000815",
};

export const FINISH_ORDER: FinishKey[] = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "diamond",
];

export const FINISHES: Record<FinishKey, Finish> = {
  // 1★ — premium matte bronze. Still a card you're proud of (§31): warm dark
  // metal, minimal foil, quiet confidence.
  bronze: {
    key: "bronze",
    stars: 1,
    metal: ["#2b1a0e", "#5c3a1c", "#a4713a", "#d9a05e", "#7a4f24", "#2b1a0e"],
    metalHighlight: "#e8b877",
    metalShadow: "#1c1108",
    background: { top: "#1a120c", mid: "#0e0a07", bottom: "#070503" },
    lightHue: "#c98a4b",
    lightIntensity: 0.35,
    foilIntensity: 0.03,
    spectral: ["#d9a05e", "#f0c98e", "#d9a05e"],
    starMaterial: { from: "#e8b877", to: "#8a5a28" },
    palette: derivePalette(PLATINUM_PALETTE, LEVEL_LOOKS.bronze),
  },
  // 2★ — silver, subtle foil begins.
  silver: {
    key: "silver",
    stars: 2,
    metal: ["#23262a", "#565c64", "#aeb6c0", "#eef2f6", "#7c848e", "#23262a"],
    metalHighlight: "#f4f7fa",
    metalShadow: "#15171a",
    background: { top: "#14161a", mid: "#0b0d10", bottom: "#050607" },
    lightHue: "#b9c4d0",
    lightIntensity: 0.45,
    foilIntensity: 0.18,
    spectral: ["#aeb6c0", "#e8f1ff", "#c9d4e2", "#aeb6c0"],
    starMaterial: { from: "#f4f7fa", to: "#848d98" },
    palette: derivePalette(PLATINUM_PALETTE, LEVEL_LOOKS.silver),
  },
  // 3★ — gold, true holographic behavior arrives.
  gold: {
    key: "gold",
    stars: 3,
    metal: ["#3a2a06", "#8a660f", "#d9ab2e", "#ffe89a", "#a87f16", "#3a2a06"],
    metalHighlight: "#ffee9d",
    metalShadow: "#241a04",
    background: { top: "#191307", mid: "#0e0b05", bottom: "#060502" },
    lightHue: "#e6b73a",
    lightIntensity: 0.55,
    foilIntensity: 0.45,
    spectral: ["#d9ab2e", "#fff3b8", "#e0742e", "#d9ab2e"],
    starMaterial: { from: "#ffee9d", to: "#a87f16" },
    palette: derivePalette(PLATINUM_PALETTE, LEVEL_LOOKS.gold),
  },
  // 4★ — platinum: cool, iridescent, the geometric MASTER finish.
  platinum: {
    key: "platinum",
    stars: 4,
    metal: ["#1f2f3a", "#4a7c94", "#9fd3e8", "#eefaff", "#6d9ab0", "#1f2f3a"],
    metalHighlight: "#f2fbff",
    metalShadow: "#13202a",
    background: { top: "#101820", mid: "#0a0f14", bottom: "#04070a" },
    lightHue: "#9fd3e8",
    lightIntensity: 0.65,
    foilIntensity: 0.75,
    spectral: ["#9fd3e8", "#e9d6ff", "#8affd6", "#9fb2ff", "#9fd3e8"],
    starMaterial: { from: "#f2fbff", to: "#5f93ab" },
    palette: PLATINUM_PALETTE,
  },
  // 5★ — diamond: maximum, sophisticated. Absolutely no gems/wings/crowns or
  // rainbow clutter (§35) — restraint at full intensity.
  diamond: {
    key: "diamond",
    stars: 5,
    metal: ["#252a33", "#6b7f96", "#cfe4f4", "#ffffff", "#8fa6bd", "#252a33"],
    metalHighlight: "#ffffff",
    metalShadow: "#161a21",
    background: { top: "#12161d", mid: "#0b0e13", bottom: "#050608" },
    lightHue: "#dceafe",
    lightIntensity: 0.75,
    foilIntensity: 1.0,
    spectral: ["#cfe4f4", "#ffd9ec", "#d9ffe9", "#d9e4ff", "#cfe4f4"],
    starMaterial: { from: "#ffffff", to: "#8fa6bd" },
    palette: derivePalette(PLATINUM_PALETTE, LEVEL_LOOKS.diamond),
  },
};

/** Finish tokens for a star count (1–5). */
export function finishForStars(stars: number): Finish {
  const key = FINISH_ORDER[Math.min(5, Math.max(1, Math.round(stars))) - 1];
  return FINISHES[key];
}

/** Finish tokens for a career-points total. */
export function finishForPoints(points: number): Finish {
  return finishForStars(starsForPoints(points));
}

// ---- TEAM TOKENS = environmental identity (v4 clarification 4) -------------
//
// The SECOND identity system, deliberately separate from FINISHES:
//   FINISH TOKENS = collectible MATERIAL (owned by prospect level — chassis
//                   metal, bevels, edges, foil intensity, reflectivity, number
//                   material family, star material, value progression).
//   TEAM TOKENS   = environmental IDENTITY (owned by the team — subtle
//                   background/environment illumination, atmospheric energy,
//                   selected accent lighting, first-name accent, restrained
//                   accent lines, player environmental backlight).
// Team color NEVER recolors or overrides the physical prospect metal: a 3★
// player on a red team gets a GOLD chassis with restrained RED environment.
// These two are never merged into one theme object; the compositor takes
// `finish` and `teamAccent` as separate props.

export type TeamAccent = {
  /** The one team hue used for environmental identity (hex). */
  hue: string;
  /** rgba() helpers pre-baked at the intensities the compositor uses. */
  illumination: string; // background/environment glow
  atmosphere: string; // particle/energy tint
  backlight: string; // player environmental backlight tint
  text: string; // first-name accent (readability-safe)
};

/** Derive the team's environmental tokens from its brand colors. */
export function teamAccentFor(team: {
  primaryColor?: string | null;
  secondaryColor?: string | null;
}): TeamAccent {
  const hue = accentColor(team.primaryColor, team.secondaryColor);
  return {
    hue,
    illumination: withAlpha(hue, 0.18),
    atmosphere: withAlpha(hue, 0.22),
    backlight: withAlpha(hue, 0.28),
    text: numberColor(team.primaryColor, team.secondaryColor),
  };
}
