import { describe, expect, it } from "vitest";
import { shoulderRoots } from "../lib/portrait/foil";
import type { PortraitMetaV2 } from "../lib/portrait/normalize";

// Where the Platinum energy attaches: the top of each shoulder, measured from
// synthetic chest-up silhouettes. 200x200 px cutout; scale 1/300 maps 1 px to
// 5 card units, so card x = 5 * px (+ tx * 1000) and y = 5 * px (+ ty * 1500).

const SIZE = 200;
const CENTER = 100;
const CHIN = 80; // faceBox bottom

function meta(overrides: Partial<PortraitMetaV2> = {}): PortraitMetaV2 {
  return {
    version: 2,
    srcW: SIZE,
    srcH: SIZE,
    faceBox: { x: 80, y: 40, w: 40, h: 40 },
    eyeY: 55,
    headTopY: 20,
    shoulderY: 103,
    scale: 1 / 300,
    tx: 0,
    ty: 0,
    ...overrides,
  };
}

/** Alpha map from a half-width per row (and side), centered on CENTER. */
function silhouette(halfWidth: (y: number, side: -1 | 1) => number) {
  const pixels = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (const side of [-1, 1] as const) {
      const w = Math.min(95, Math.round(halfWidth(y, side)));
      for (let d = 0; d < w; d++) pixels[(y * SIZE + CENTER + side * d + (side < 0 ? -1 : 0)) * 4 + 3] = 255;
    }
  }
  return pixels;
}

/** Head, a neck of half-width 12, then shoulders widening at `slope` px/row from row 95. */
const body = (y: number, slope = 3) =>
  y < 20 ? 0 : y < CHIN ? 22 : y < 95 ? 12 : 12 + (y - 95) * slope;

describe("shoulderRoots", () => {
  it("attaches below the neck, out on the shoulder", () => {
    const roots = shoulderRoots(silhouette((y) => body(y)), SIZE, SIZE, meta())!;
    // Neck edges at x 88 and 111; 0.3 face widths (12 px) further out is
    // reached on row 99, at x 76 and 123.
    expect(roots.left.x).toBeCloseTo(76 * 5, 5);
    expect(roots.right.x).toBeCloseTo(123 * 5, 5);
    expect(roots.left.y).toBeCloseTo(99 * 5, 5);
    expect(roots.right.y).toBeCloseTo(99 * 5, 5);
  });

  it("finds the shoulders under long hair instead of the hair beside the chin", () => {
    // A hair curtain (half-width 30) hides the neck down to row 110.
    const roots = shoulderRoots(silhouette((y) => Math.max(y >= 20 && y <= 110 ? 30 : 0, body(y))), SIZE, SIZE, meta())!;
    // The shoulders pass the hair at row 102; 12 px beyond it is row 105.
    expect(roots.left.y).toBeCloseTo(105 * 5, 0);
    expect(roots.left.x).toBeLessThan((CENTER - 30) * 5 - 50);
  });

  it("follows each shoulder's own slope", () => {
    const roots = shoulderRoots(silhouette((y, side) => body(y, side < 0 ? 6 : 1.5)), SIZE, SIZE, meta())!;
    // The steeper left shoulder is 12 px out by row 97; the sloping right one by row 103.
    expect(roots.left.y).toBeCloseTo(97 * 5, 5);
    expect(roots.right.y).toBeCloseTo(103 * 5, 5);
  });

  it("maps through the portrait transform into card units", () => {
    const plain = shoulderRoots(silhouette((y) => body(y)), SIZE, SIZE, meta())!;
    const moved = shoulderRoots(silhouette((y) => body(y)), SIZE, SIZE, meta({ tx: 0.05, ty: 0.1 }))!;
    expect(moved.left.x - plain.left.x).toBeCloseTo(50, 5);
    expect(moved.left.y - plain.left.y).toBeCloseTo(150, 5);
    // Downsampled alpha lands on the same card point.
    const half = new Uint8ClampedArray((SIZE / 2) * (SIZE / 2) * 4);
    const full = silhouette((y) => body(y));
    for (let y = 0; y < SIZE / 2; y++) for (let x = 0; x < SIZE / 2; x++) {
      half[(y * (SIZE / 2) + x) * 4 + 3] = full[(y * 2 * SIZE + x * 2) * 4 + 3];
    }
    const small = shoulderRoots(half, SIZE / 2, SIZE / 2, meta())!;
    expect(Math.abs(small.left.x - plain.left.x)).toBeLessThanOrEqual(15);
    expect(Math.abs(small.left.y - plain.left.y)).toBeLessThanOrEqual(15);
  });

  it("returns null when there are no shoulders to attach to", () => {
    // Never widens below the chin (e.g. a head-only crop): keep the authored layout.
    expect(shoulderRoots(silhouette((y) => (y >= 20 ? 22 : 0)), SIZE, SIZE, meta())).toBeNull();
    expect(shoulderRoots(new Uint8ClampedArray(SIZE * SIZE * 4), SIZE, SIZE, meta())).toBeNull();
  });
});
