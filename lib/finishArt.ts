// LEVEL LOOKS — how Bronze, Silver, Gold and Diamond derive from the approved
// Platinum art (owner decision, 2026-09-25: recolor the Platinum art with a
// script; any file can later be replaced by designer art under the same name).
//
// A level recolors by gradient map: each pixel's brightness picks a color from
// the level's ramp, so every facet, star and current keeps its shape and only
// the material changes. The same ramps color the live layers (number, text
// accents, energy) through derivePalette, so they always match the art.
// Pure functions: used by scripts/card-art.ts (pixels) and lib/cardTheme.ts
// (palettes).

import type { FinishKey, FinishPalette } from "./cardTheme";

/** Brightness (0..1) → color stops, ascending. */
export type Ramp = [at: number, color: string][];

export type Recolor = {
  ramp: Ramp;
  /** Share of the original Platinum color kept (Diamond's prismatic hint). */
  keep?: number;
  /** Brightness multiplier after mapping (quieter energy on lower levels). */
  gain?: number;
};

export type LevelLook = {
  /** The metal frame, outside FRAME_WINDOW. */
  frame: Recolor;
  /** The card face behind the player, inside FRAME_WINDOW. */
  window: Recolor;
  /** The energy field. */
  field: Recolor;
  /** Live layers: number, text accents, energy colors. */
  live: Recolor;
  /** How strongly the energy leaves the player (Platinum is 1). */
  energy: number;
};

/** Each level must read as more premium than the one below; metal names
 * never print on the card. */
export const LEVEL_LOOKS: Record<Exclude<FinishKey, "platinum">, LevelLook> = {
  // Warm matte bronze, little energy.
  bronze: {
    frame: { ramp: [[0, "#0d0703"], [0.3, "#35200f"], [0.55, "#6e4322"], [0.75, "#a4703f"], [0.9, "#cf9c66"], [1, "#ecc99a"]] },
    window: { ramp: [[0, "#030201"], [0.3, "#140b05"], [0.6, "#3a2311"], [0.85, "#94613a"], [1, "#e0bb90"]] },
    field: { ramp: [[0, "#000000"], [0.35, "#0e0703"], [0.65, "#4a2a12"], [0.88, "#b27442"], [1, "#f1cfa4"]], gain: 0.35 },
    live: { ramp: [[0, "#000000"], [0.2, "#1a0e05"], [0.45, "#5e3517"], [0.65, "#a8622c"], [0.8, "#d99159"], [0.92, "#f2c393"], [1, "#fff1e0"]] },
    energy: 0.3,
  },
  // Cool steel, faint energy.
  silver: {
    frame: { ramp: [[0, "#0b0c0e"], [0.3, "#383c42"], [0.55, "#80878f"], [0.75, "#c1c7cf"], [0.9, "#eceff3"], [1, "#ffffff"]] },
    window: { ramp: [[0, "#030304"], [0.3, "#101316"], [0.6, "#373e47"], [0.85, "#96a1ad"], [1, "#eef2f6"]] },
    field: { ramp: [[0, "#000000"], [0.3, "#0b0d10"], [0.6, "#434b56"], [0.85, "#aeb9c6"], [1, "#ffffff"]], gain: 0.6 },
    live: { ramp: [[0, "#000000"], [0.2, "#121417"], [0.45, "#3f464f"], [0.65, "#7d8793"], [0.8, "#b9c3ce"], [0.92, "#e6ecf2"], [1, "#ffffff"]] },
    energy: 0.55,
  },
  // Warm gold, visible energy.
  gold: {
    frame: { ramp: [[0, "#110b02"], [0.25, "#473007"], [0.5, "#976c16"], [0.7, "#d6a73a"], [0.85, "#f5d987"], [1, "#fffbe6"]] },
    window: { ramp: [[0, "#040301"], [0.3, "#1a1105"], [0.6, "#553910"], [0.85, "#c68f2c"], [1, "#ffefbe"]] },
    field: { ramp: [[0, "#000000"], [0.2, "#100801"], [0.45, "#573206"], [0.7, "#d4841b"], [0.88, "#ffcd6a"], [1, "#fffaee"]] },
    live: { ramp: [[0, "#000000"], [0.15, "#1a0f02"], [0.35, "#5a3606"], [0.55, "#b8740e"], [0.72, "#f0a82a"], [0.86, "#ffd77a"], [1, "#fffaf0"]] },
    energy: 0.85,
  },
  // The brightest: white and ice, with a restrained prismatic hint. No gems,
  // wings, crowns or rainbow clutter.
  diamond: {
    frame: { ramp: [[0, "#0d1015"], [0.25, "#4d5868"], [0.5, "#a8bacb"], [0.7, "#e6f0f8"], [0.85, "#ffffff"], [1, "#ffffff"]], keep: 0.3 },
    window: { ramp: [[0, "#030406"], [0.3, "#0c1015"], [0.6, "#374556"], [0.85, "#b8d0e6"], [1, "#ffffff"]], keep: 0.2 },
    field: { ramp: [[0, "#000000"], [0.25, "#0c1016"], [0.5, "#5e748a"], [0.75, "#dce9f6"], [0.9, "#ffffff"], [1, "#ffffff"]], keep: 0.2, gain: 1.15 },
    live: { ramp: [[0, "#000000"], [0.2, "#0e1218"], [0.45, "#4a5a6e"], [0.65, "#a3b9ce"], [0.8, "#dbe9f6"], [0.92, "#f5f9ff"], [1, "#ffffff"]], keep: 0.25 },
    energy: 1,
  },
};

// ---- the recolor -----------------------------------------------------------

/** Brightness fed to a ramp, 0..255: mostly luma (keeps the structure), part
 * max channel (so vivid blue glow stays vivid instead of collapsing to dark). */
export function brightness(r: number, g: number, b: number): number {
  return Math.min(255, Math.round(0.6 * (0.2126 * r + 0.7152 * g + 0.0722 * b) + 0.4 * Math.max(r, g, b)));
}

function parseHex(hex: string): [number, number, number, number | null] {
  const h = hex.replace("#", "");
  const full = h.length <= 4 ? [...h].map((c) => c + c).join("") : h;
  const n = (i: number) => parseInt(full.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), full.length === 8 ? n(6) : null];
}

const hex2 = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");

/** A 256-entry lookup table (RGB triplets) for a ramp. */
export function rampTable(ramp: Ramp): Uint8Array {
  const stops = ramp.map(([at, color]) => [at, ...parseHex(color).slice(0, 3)] as number[]);
  const table = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [t0, ...c0] = stops[k];
    const [t1, ...c1] = stops[k + 1];
    const f = Math.max(0, Math.min(1, (t - t0) / (t1 - t0 || 1)));
    for (let c = 0; c < 3; c++) table[i * 3 + c] = Math.round(c0[c] + (c1[c] - c0[c]) * f);
  }
  return table;
}

/** Recolor one channel of one pixel (0..255). */
export function recolorChannel(table: Uint8Array, level: number, channel: number, original: number, spec: Recolor): number {
  const keep = spec.keep ?? 0;
  const mapped = table[level * 3 + channel] * (1 - keep) + original * keep;
  return Math.min(255, mapped * (spec.gain ?? 1));
}

/** Recolor a CSS hex color (#rgb, #rgba, #rrggbb or #rrggbbaa); alpha is kept. */
export function recolorHex(color: string, spec: Recolor, table = rampTable(spec.ramp)): string {
  const [r, g, b, a] = parseHex(color);
  const level = brightness(r, g, b);
  const rgb = [r, g, b].map((v, c) => hex2(recolorChannel(table, level, c, v, spec))).join("");
  return `#${rgb}${a === null ? "" : hex2(a)}`;
}

/** A level's live-layer palette: Platinum's, recolored through its ramp. */
export function derivePalette(platinum: FinishPalette, look: LevelLook): FinishPalette {
  const table = rampTable(look.live.ramp);
  const map = <T>(value: T): T => {
    if (typeof value === "string") return recolorHex(value, look.live, table) as T;
    if (Array.isArray(value)) return value.map(map) as T;
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, map(v)])) as T;
    }
    return value;
  };
  const palette = map(platinum);
  return { ...palette, energy: { ...palette.energy, strength: look.energy } };
}
