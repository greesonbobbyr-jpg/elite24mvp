import { describe, expect, it } from "vitest";
import { DIAMOND_PALETTE, FINISHES, FINISH_ORDER, PLATINUM_PALETTE } from "../lib/cardTheme";
import { LEVEL_LOOKS, brightness, derivePalette, pixelRecolor, rampTable, recolorHex } from "../lib/finishArt";

// Level looks: Bronze, Silver and Gold derive their live colors from
// Platinum's through the same ramps that recolor their art; Diamond's are
// authored to match its holographic art (lib/finishArt.ts).

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/;
const gold = LEVEL_LOOKS.gold.live!;

function colors(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(colors);
  if (value && typeof value === "object") return Object.values(value).flatMap(colors);
  return [];
}

describe("recolorHex", () => {
  it("maps brightness through the ramp's ends", () => {
    expect(recolorHex("#000000", gold)).toBe("#000000");
    expect(recolorHex("#ffffff", gold)).toBe("#fff5e0");
  });

  it("keeps alpha and accepts short forms", () => {
    expect(recolorHex("#fff9", gold)).toBe("#fff5e099");
    expect(recolorHex("#b8efff60", gold).slice(7)).toBe("60");
    expect(recolorHex("#fff", gold)).toBe(recolorHex("#ffffff", gold));
  });

  it("keeps vivid glow vivid (brightness uses the max channel too)", () => {
    // Platinum's blue aura is dark by luma alone; it must stay a bright glow.
    expect(brightness(0x16, 0x8c, 0xff)).toBeGreaterThan(160);
  });

  it("builds a monotonic table for an ascending ramp", () => {
    const table = rampTable(LEVEL_LOOKS.silver.live!.ramp);
    for (let i = 1; i < 256; i++) expect(table[i * 3 + 1]).toBeGreaterThanOrEqual(table[(i - 1) * 3 + 1]);
  });
});

describe("holographic foil", () => {
  const field = LEVEL_LOOKS.diamond.field;
  const recolor = pixelRecolor({ ...field, gain: 1 }, 1000, 1500);
  const at = (x: number, y: number, r = 110, g = 110, b = 110) => {
    const out = [0, 0, 0];
    recolor(r, g, b, x, y, out);
    return out.map(Math.round);
  };

  it("tints the same current differently across the card", () => {
    expect(at(100, 200)).not.toEqual(at(700, 1100));
  });

  it("keeps darks dark and highlights white", () => {
    expect(Math.max(...at(400, 400, 0, 0, 0))).toBe(0);
    expect(Math.min(...at(400, 400, 255, 255, 255))).toBeGreaterThan(245);
  });
});

describe("level palettes", () => {
  it("Platinum keeps its approved palette exactly", () => {
    expect(FINISHES.platinum.palette).toBe(PLATINUM_PALETTE);
  });

  it("every level has a complete, valid palette", () => {
    const shape = (palette: typeof PLATINUM_PALETTE) => colors({ ...palette, holo: undefined }).length;
    for (const key of FINISH_ORDER) {
      const palette = FINISHES[key].palette;
      expect(shape(palette)).toBe(shape(PLATINUM_PALETTE));
      if (key !== "platinum") for (const color of colors(palette)) expect(color).toMatch(HEX);
    }
  });

  it("energy grows with the level, and only Diamond is holographic", () => {
    const strengths = FINISH_ORDER.map((key) => FINISHES[key].palette.energy.strength);
    for (let i = 1; i < strengths.length; i++) expect(strengths[i]).toBeGreaterThanOrEqual(strengths[i - 1]);
    for (const key of FINISH_ORDER) expect(Boolean(FINISHES[key].palette.holo)).toBe(key === "diamond");
    expect(FINISHES.diamond.palette).toBe(DIAMOND_PALETTE);
  });

  it("derives Gold's number glow as a warm color", () => {
    const [r, , b] = [1, 3, 5].map((i) => parseInt(derivePalette(PLATINUM_PALETTE, LEVEL_LOOKS.gold).number.aura.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(b + 100);
  });
});
