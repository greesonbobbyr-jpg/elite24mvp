import { describe, expect, it } from "vitest";
import {
  TIERS,
  tierForPoints,
  starsForPoints,
  FINISHES,
  FINISH_ORDER,
  finishForStars,
  finishForPoints,
} from "../lib/cardTheme";
import { giantNumber, surnameSize, SURNAME } from "../lib/cardGeometry";

// CARD REDESIGN Stage 1 proofs — thresholds, stars, finish tokens, geometry
// helpers. Pure functions, no DB.

describe("tier thresholds (owner-locked 0/1k/5k/20k/50k)", () => {
  it("mins are exactly the locked values", () => {
    expect(TIERS.map((t) => t.min)).toEqual([0, 1000, 5000, 20000, 50000]);
  });

  it("boundaries: the min itself reaches the tier; min-1 does not", () => {
    for (let i = 1; i < TIERS.length; i++) {
      expect(tierForPoints(TIERS[i].min).key).toBe(TIERS[i].key);
      expect(tierForPoints(TIERS[i].min - 1).key).toBe(TIERS[i - 1].key);
    }
  });
});

describe("starsForPoints", () => {
  it("1–5 stars, one per tier level reached", () => {
    expect(starsForPoints(0)).toBe(1);
    expect(starsForPoints(999)).toBe(1);
    expect(starsForPoints(1000)).toBe(2);
    expect(starsForPoints(4999)).toBe(2);
    expect(starsForPoints(5000)).toBe(3);
    expect(starsForPoints(19999)).toBe(3);
    expect(starsForPoints(20000)).toBe(4);
    expect(starsForPoints(49999)).toBe(4);
    expect(starsForPoints(50000)).toBe(5);
    expect(starsForPoints(1_000_000)).toBe(5);
  });
});

describe("finish tokens (Δ2/Δ4 — material only, geometry elsewhere)", () => {
  it("five finishes mapped 1:1 onto star counts", () => {
    expect(FINISH_ORDER).toHaveLength(5);
    FINISH_ORDER.forEach((key, i) => {
      expect(FINISHES[key].stars).toBe(i + 1);
      expect(finishForStars(i + 1).key).toBe(key);
    });
  });

  it("foilIntensity progression is strictly increasing (sacred)", () => {
    const foils = FINISH_ORDER.map((k) => FINISHES[k].foilIntensity);
    for (let i = 1; i < foils.length; i++) {
      expect(foils[i]).toBeGreaterThan(foils[i - 1]);
    }
  });

  it("lightIntensity also rises with level", () => {
    const lights = FINISH_ORDER.map((k) => FINISHES[k].lightIntensity);
    for (let i = 1; i < lights.length; i++) {
      expect(lights[i]).toBeGreaterThan(lights[i - 1]);
    }
  });

  it("points → finish agrees with points → stars", () => {
    for (const pts of [0, 999, 1000, 5000, 20000, 50000, 80000]) {
      expect(finishForPoints(pts).stars).toBe(starsForPoints(pts));
    }
  });

  it("finishForStars clamps out-of-range input", () => {
    expect(finishForStars(0).key).toBe("bronze");
    expect(finishForStars(9).key).toBe("diamond");
  });
});

describe("geometry helpers", () => {
  it("giant number pads single digits only; strips non-digits", () => {
    expect(giantNumber(7)).toBe("07");
    expect(giantNumber("7")).toBe("07");
    expect(giantNumber(22)).toBe("22");
    expect(giantNumber("#7")).toBe("07");
    expect(giantNumber(0)).toBe("00");
    expect(giantNumber(null)).toBe("");
    expect(giantNumber("")).toBe("");
  });

  it("surname fitting: clamped, monotonic, never wraps outside bounds", () => {
    expect(surnameSize("WALLACE")).toBe(SURNAME.maxSize); // 7 chars
    expect(surnameSize("LI")).toBe(SURNAME.maxSize);
    expect(surnameSize("A".repeat(20))).toBe(SURNAME.minSize);
    let prev = Infinity;
    for (let n = 2; n <= 20; n++) {
      const s = surnameSize("A".repeat(n));
      expect(s).toBeLessThanOrEqual(prev);
      expect(s).toBeLessThanOrEqual(SURNAME.maxSize);
      expect(s).toBeGreaterThanOrEqual(SURNAME.minSize);
      prev = s;
    }
  });
});
