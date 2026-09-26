// LEVEL LOOKS — how Bronze, Silver, Gold and Diamond derive from the approved
// Platinum art (owner decision, 2026-09-25: recolor the Platinum art with a
// script; any file can later be replaced by designer art under the same name).
//
// A level recolors by gradient map: each pixel's brightness picks a color from
// the level's ramp, so every facet, star and current keeps its shape and only
// the material changes. Diamond adds holographic foil on top of its ramp. The
// same ramps color the live layers (number, text accents, energy) through
// derivePalette, so they always match the art; Diamond's palette is authored.
// Pure functions: used by scripts/card-art.ts (pixels) and lib/cardTheme.ts
// (palettes).

import type { FinishKey, FinishPalette } from "./cardTheme";

/** Brightness (0..1) → color stops, ascending. */
export type Ramp = [at: number, color: string][];

/** Holographic foil: spectral colors that drift across the card and shift with
 * each current's brightness, laid over the ramp like real holo foil (darks stay
 * dark, highlights stay white). */
export type Holo = {
  /** Spectral colors, cycled across the card. */
  colors: string[];
  /** Color cycles along the card's diagonal. */
  cycles: number;
  /** How strongly the foil tints the ramp, 0..1. */
  strength: number;
};

export type Recolor = {
  ramp: Ramp;
  holo?: Holo;
  /** Share of the original Platinum color kept. */
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
  /** Live layers (number, text accents, energy colors): Platinum's palette
   * through this ramp. Without one, the level's palette is authored. */
  live?: Recolor;
  /** How strongly the energy leaves the player (Platinum is 1). */
  energy: number;
  /** Twists in this level's copy of the energy, so no two levels' currents
   * are identical (owner review, 2026-09-26: "same effect but not all the
   * exact same"). */
  swirls: Swirl[];
};

/** Texture within `radius` card units of (x, y) turns by up to `turn`
 * radians at the center, easing to none at the edge. Keep every swirl more
 * than its radius from the field's hot nodes (223,796 and 762,805), so the
 * energy still leaves the shoulders. */
export type Swirl = { x: number; y: number; radius: number; turn: number };

/** Diamond's foil spectrum: cyan, blue, violet, magenta, gold, mint. */
export const HOLO_SPECTRUM = ["#35f0ff", "#5b7cff", "#b150ff", "#ff4fd8", "#ffd166", "#47ffb5"];

/** A gradual climb (owner review, 2026-09-26): each level reads as more
 * premium than the one below, Gold stays under Platinum, and Diamond is the
 * wild, holographic top. Metal names never print on the card. */
export const LEVEL_LOOKS: Record<Exclude<FinishKey, "platinum">, LevelLook> = {
  // Warm matte bronze, little energy. Owner-approved 2026-09-26 (swirls too).
  bronze: {
    frame: { ramp: [[0, "#0d0703"], [0.3, "#35200f"], [0.55, "#6e4322"], [0.75, "#a4703f"], [0.9, "#cf9c66"], [1, "#ecc99a"]] },
    window: { ramp: [[0, "#030201"], [0.3, "#140b05"], [0.6, "#3a2311"], [0.85, "#94613a"], [1, "#e0bb90"]] },
    field: { ramp: [[0, "#000000"], [0.35, "#0e0703"], [0.65, "#4a2a12"], [0.88, "#b27442"], [1, "#f1cfa4"]], gain: 0.35 },
    live: { ramp: [[0, "#000000"], [0.2, "#1a0e05"], [0.45, "#5e3517"], [0.65, "#a8622c"], [0.8, "#d99159"], [0.92, "#f2c393"], [1, "#fff1e0"]] },
    energy: 0.3,
    swirls: [{ x: 170, y: 280, radius: 230, turn: 0.9 }, { x: 840, y: 330, radius: 230, turn: -0.8 }],
  },
  // Cool steel, faint energy. Owner-approved 2026-09-26 (swirls too).
  silver: {
    frame: { ramp: [[0, "#0b0c0e"], [0.3, "#383c42"], [0.55, "#80878f"], [0.75, "#c1c7cf"], [0.9, "#eceff3"], [1, "#ffffff"]] },
    window: { ramp: [[0, "#030304"], [0.3, "#101316"], [0.6, "#373e47"], [0.85, "#96a1ad"], [1, "#eef2f6"]] },
    field: { ramp: [[0, "#000000"], [0.3, "#0b0d10"], [0.6, "#434b56"], [0.85, "#aeb9c6"], [1, "#ffffff"]], gain: 0.6 },
    live: { ramp: [[0, "#000000"], [0.2, "#121417"], [0.45, "#3f464f"], [0.65, "#7d8793"], [0.8, "#b9c3ce"], [0.92, "#e6ecf2"], [1, "#ffffff"]] },
    energy: 0.55,
    swirls: [{ x: 210, y: 420, radius: 240, turn: -0.9 }, { x: 800, y: 240, radius: 250, turn: 0.8 }, { x: 110, y: 1030, radius: 150, turn: 0.7 }],
  },
  // True yellow gold (orange amber read too close to Bronze's copper), with
  // visible energy kept a step under Platinum: darker frame, dimmer energy
  // and number glow. Owner-approved 2026-09-26.
  gold: {
    frame: { ramp: [[0, "#110c02"], [0.25, "#463507"], [0.5, "#947214"], [0.7, "#cfaa38"], [0.85, "#eed683"], [1, "#fdf6dc"]] },
    window: { ramp: [[0, "#040301"], [0.3, "#181205"], [0.6, "#52400f"], [0.85, "#bf9a30"], [1, "#fbeebd"]] },
    field: { ramp: [[0, "#000000"], [0.2, "#100b01"], [0.45, "#5a4608"], [0.7, "#d3a722"], [0.88, "#ffe07a"], [1, "#fffcee"]], gain: 0.7 },
    live: { ramp: [[0, "#000000"], [0.15, "#181202"], [0.35, "#554005"], [0.55, "#ad840e"], [0.72, "#dfb42a"], [0.86, "#f6dc80"], [1, "#fffbea"]] },
    energy: 0.65,
    swirls: [{ x: 150, y: 200, radius: 240, turn: 1.1 }, { x: 860, y: 430, radius: 240, turn: -1 }, { x: 880, y: 1040, radius: 150, turn: -0.8 }],
  },
  // The top: a crystal frame and white-hot energy in holographic foil. Its
  // live palette (DIAMOND_PALETTE in lib/cardTheme.ts) is authored.
  // Owner-approved 2026-09-26.
  diamond: {
    frame: { ramp: [[0, "#0d1015"], [0.25, "#555f6e"], [0.5, "#b0bfcd"], [0.7, "#eaf2f9"], [0.85, "#ffffff"], [1, "#ffffff"]], holo: { colors: HOLO_SPECTRUM, cycles: 3, strength: 0.6 } },
    window: { ramp: [[0, "#030306"], [0.3, "#0c0a14"], [0.6, "#3a3450"], [0.85, "#d6d0ee"], [1, "#ffffff"]], holo: { colors: HOLO_SPECTRUM, cycles: 2, strength: 0.6 } },
    field: { ramp: [[0, "#000000"], [0.25, "#0c0d12"], [0.5, "#6c7280"], [0.75, "#e6e9ef"], [0.9, "#ffffff"], [1, "#ffffff"]], holo: { colors: HOLO_SPECTRUM, cycles: 1.8, strength: 0.9 }, gain: 1.2 },
    energy: 1,
    swirls: [{ x: 230, y: 250, radius: 260, turn: -1.3 }, { x: 770, y: 320, radius: 260, turn: 1.3 }, { x: 100, y: 560, radius: 170, turn: 0.9 }, { x: 900, y: 1020, radius: 150, turn: 0.9 }],
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

/** Overlay blend of one channel (0..255): tints mid-tones, keeps black and white. */
const overlay = (base: number, top: number) =>
  base < 128 ? (2 * base * top) / 255 : 255 - (2 * (255 - base) * (255 - top)) / 255;

/** Compile a recolor for an image of the given size. The returned function
 * writes the new RGB of pixel (r, g, b) at (x, y) into `out`. */
export function pixelRecolor(spec: Recolor, width: number, height: number) {
  const table = rampTable(spec.ramp);
  const keep = spec.keep ?? 0;
  const gain = spec.gain ?? 1;
  const holo = spec.holo;
  const spectrum = holo?.colors.map((color) => parseHex(color).slice(0, 3) as number[]) ?? [];
  const mapped = [0, 0, 0];
  return (r: number, g: number, b: number, x: number, y: number, out: number[]) => {
    const level = brightness(r, g, b);
    for (let c = 0; c < 3; c++) mapped[c] = table[level * 3 + c];
    if (holo) {
      // Diagonal bands, nudged by brightness so neighboring currents differ.
      const along = holo.cycles * (0.7 * (x / width) + 0.45 * (y / height)) + 0.25 * (level / 255);
      const p = (along - Math.floor(along)) * spectrum.length;
      const i = Math.floor(p) % spectrum.length;
      const j = (i + 1) % spectrum.length;
      const f = p - Math.floor(p);
      for (let c = 0; c < 3; c++) {
        const foil = spectrum[i][c] + (spectrum[j][c] - spectrum[i][c]) * f;
        mapped[c] += (overlay(mapped[c], foil) - mapped[c]) * holo.strength;
      }
    }
    const original = [r, g, b];
    for (let c = 0; c < 3; c++) out[c] = Math.min(255, (mapped[c] * (1 - keep) + original[c] * keep) * gain);
  };
}

/** Where output pixel (x, y) samples from, undoing each swirl. `unit` is
 * image pixels per card unit. */
export function swirlSource(x: number, y: number, swirls: Swirl[], unit: number): [number, number] {
  let sx = x;
  let sy = y;
  for (const s of swirls) {
    const cx = s.x * unit;
    const cy = s.y * unit;
    const r = s.radius * unit;
    const dx = sx - cx;
    const dy = sy - cy;
    const d = Math.hypot(dx, dy);
    if (d >= r) continue;
    const a = -s.turn * (1 - d / r) ** 2;
    sx = cx + dx * Math.cos(a) - dy * Math.sin(a);
    sy = cy + dx * Math.sin(a) + dy * Math.cos(a);
  }
  return [sx, sy];
}

/** Recolor a CSS hex color (#rgb, #rgba, #rrggbb or #rrggbbaa) through a
 * ramp; alpha is kept. (Colors have no position, so no holo.) */
export function recolorHex(color: string, spec: Recolor): string {
  const [r, g, b, a] = parseHex(color);
  const out = [0, 0, 0];
  pixelRecolor({ ...spec, holo: undefined }, 1, 1)(r, g, b, 0, 0, out);
  return `#${out.map(hex2).join("")}${a === null ? "" : hex2(a)}`;
}

/** A level's live-layer palette: Platinum's, recolored through its live ramp. */
export function derivePalette(platinum: FinishPalette, look: LevelLook): FinishPalette {
  const live = look.live;
  if (!live) throw new Error("This level authors its palette; it has no live ramp.");
  const map = <T>(value: T): T => {
    if (typeof value === "string") return recolorHex(value, live) as T;
    if (Array.isArray(value)) return value.map(map) as T;
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, map(v)])) as T;
    }
    return value;
  };
  const palette = map(platinum);
  return { ...palette, energy: { ...palette.energy, strength: look.energy } };
}
