// Color + tier logic for the PlayerCard. Pure functions, no DB. The whole card
// scheme derives from a team's primaryColor + secondaryColor; if a team has no
// colors yet, everything falls back to the app's red/black. Readability is a
// hard guardrail: text always sits on a darkened zone, never colored-on-colored,
// so these helpers only ever produce DARK card bases + return a scrim to layer
// behind text.

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
  const base = primary && hexToRgb(primary) ? primary : APP_RED;
  const isFallback = !(primary && hexToRgb(primary));

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

// Deliberately NOT easy — Platinum ≈ weeks of daily max effort. Single source of
// truth; re-tune here only.
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
    min: 100,
    // deep bronze → bright copper → brown
    ring: ["#3f2410", "#7a4a20", "#d98f4e", "#f0b877", "#9a5f2c", "#3f2410"],
    glow: "rgba(200,120,60,0.35)",
    glint: 0.14,
    sweepSec: 6,
  },
  {
    key: "silver",
    label: "Silver",
    min: 300,
    // charcoal → white-hot → grey
    ring: ["#2f3236", "#6b7178", "#c9ced6", "#ffffff", "#8b9199", "#2f3236"],
    glow: "rgba(210,220,230,0.30)",
    glint: 0.2,
    sweepSec: 5.5,
  },
  {
    key: "gold",
    label: "Gold",
    min: 700,
    // dark gold/amber → pale-gold highlight → dark gold
    ring: ["#4d3608", "#997012", "#e6b73a", "#fff1b0", "#b98f1e", "#4d3608"],
    glow: "rgba(230,183,58,0.45)",
    glint: 0.26,
    sweepSec: 5,
  },
  {
    key: "platinum",
    label: "Platinum",
    min: 1500,
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
