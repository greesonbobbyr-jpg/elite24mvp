import { describe, expect, it } from "vitest";
import { FINISHES, FINISH_ORDER, PLATINUM_PALETTE } from "../lib/cardTheme";
import { LEVEL_LOOKS, brightness, derivePalette, rampTable, recolorHex } from "../lib/finishArt";

// Level looks: every level's live colors derive from Platinum's through the
// same ramps that recolor its art (lib/finishArt.ts).

const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/;

function colors(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(colors);
  if (value && typeof value === "object") return Object.values(value).flatMap(colors);
  return [];
}

describe("recolorHex", () => {
  const gold = LEVEL_LOOKS.gold.live;

  it("maps brightness through the ramp's ends", () => {
    expect(recolorHex("#000000", gold)).toBe("#000000");
    expect(recolorHex("#ffffff", gold)).toBe("#fffaf0");
  });

  it("keeps alpha and accepts short forms", () => {
    expect(recolorHex("#fff9", gold)).toBe("#fffaf099");
    expect(recolorHex("#b8efff60", gold).slice(7)).toBe("60");
    expect(recolorHex("#fff", gold)).toBe(recolorHex("#ffffff", gold));
  });

  it("keeps vivid glow vivid (brightness uses the max channel too)", () => {
    // Platinum's blue aura is dark by luma alone; it must stay a bright glow.
    expect(brightness(0x16, 0x8c, 0xff)).toBeGreaterThan(160);
  });

  it("builds a monotonic table for an ascending ramp", () => {
    const table = rampTable(LEVEL_LOOKS.silver.live.ramp);
    for (let i = 1; i < 256; i++) expect(table[i * 3 + 1]).toBeGreaterThanOrEqual(table[(i - 1) * 3 + 1]);
  });
});

describe("level palettes", () => {
  it("Platinum keeps its approved palette exactly", () => {
    expect(FINISHES.platinum.palette).toBe(PLATINUM_PALETTE);
  });

  it("every level has a complete, valid palette with its own energy strength", () => {
    for (const key of FINISH_ORDER) {
      const palette = FINISHES[key].palette;
      const list = colors({ ...palette, energy: { ...palette.energy, strength: undefined } });
      expect(list.length).toBe(colors({ ...PLATINUM_PALETTE, energy: { ...PLATINUM_PALETTE.energy, strength: undefined } }).length);
      if (key !== "platinum") for (const color of list) expect(color).toMatch(HEX);
      expect(palette.energy.strength).toBe(key === "platinum" ? 1 : LEVEL_LOOKS[key].energy);
    }
  });

  it("energy grows with the level", () => {
    const strengths = FINISH_ORDER.map((key) => FINISHES[key].palette.energy.strength);
    for (let i = 1; i < strengths.length; i++) expect(strengths[i]).toBeGreaterThanOrEqual(strengths[i - 1]);
  });

  it("derives Gold's number glow as a warm color", () => {
    const [r, , b] = [1, 3, 5].map((i) => parseInt(derivePalette(PLATINUM_PALETTE, LEVEL_LOOKS.gold).number.aura.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(b + 100);
  });
});
