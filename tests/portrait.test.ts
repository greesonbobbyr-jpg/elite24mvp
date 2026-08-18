import { describe, expect, it } from "vitest";
import {
  normalizePortrait,
  cutoutCss,
  isPortraitMetaV2,
  PORTRAIT_TARGETS as PORTRAIT,
  type PortraitAnalysis,
} from "../lib/portrait/normalize";
import { CARD_ASPECT } from "../lib/cardGeometry";

// CARD REDESIGN Stage 4 proofs — the normalization transform + Δ12
// conservative validation, against synthetic alpha-map/face-box fixtures.
// Deterministic, no browser.

function fixture(overrides: Partial<PortraitAnalysis> = {}): PortraitAnalysis {
  return {
    srcW: 800,
    srcH: 1000,
    faces: 1,
    faceBox: { x: 300, y: 150, w: 200, h: 200 },
    eyeY: 225,
    faceCenterX: 400,
    headTopY: 90,
    shoulderY: 560,
    shoulderHalfW: 280,
    contentBounds: { top: 90, left: 100, right: 700, bottom: 1000 },
    coverage: 0.4,
    brightness: 120,
    sharpness: 100,
    ...overrides,
  };
}

describe("normalizePortrait — transform", () => {
  it("anchors the eye line and shoulder line onto their card targets", () => {
    const res = normalizePortrait(fixture());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const { scale, ty, tx } = res.meta;
    expect(225 * scale + ty).toBeCloseTo(PORTRAIT.eyeY, 5);
    expect(560 * scale + ty).toBeCloseTo(PORTRAIT.shoulderY, 5);
    // Face-centered horizontally (never torso centroid).
    expect((400 * scale) / CARD_ASPECT + tx).toBeCloseTo(PORTRAIT.centerX, 5);
  });

  it("meta is the stored v2 shape", () => {
    const res = normalizePortrait(fixture());
    if (!res.ok) throw new Error("expected ok");
    expect(isPortraitMetaV2(res.meta)).toBe(true);
    expect(res.meta.version).toBe(2);
  });

  it("Δ8: tall hair clamps scale so the head stays inside the safe zone", () => {
    // Short eye→shoulder span + hair to the very top of the frame.
    const res = normalizePortrait(fixture({ headTopY: 0, shoulderY: 400 }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const mappedHeadTop = 0 * res.meta.scale + res.meta.ty;
    expect(mappedHeadTop).toBeGreaterThanOrEqual(PORTRAIT.zone.y - 1e-9);
    // The clamp engaged: eyes anchored, shoulders land ABOVE their target.
    expect(400 * res.meta.scale + res.meta.ty).toBeLessThan(PORTRAIT.shoulderY);
  });

  it("Δ8: very wide shoulders clamp to the zone's max width", () => {
    const res = normalizePortrait(fixture({ shoulderHalfW: 450 })); // span 4.5 face-heights (very wide)
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const widthFrac = (2 * 450 * res.meta.scale) / CARD_ASPECT;
    expect(widthFrac).toBeLessThanOrEqual(PORTRAIT.maxW + 1e-9);
  });

  it("missing alpha shoulder line falls back to a face-proportional estimate", () => {
    const res = normalizePortrait(fixture({ shoulderY: null, shoulderHalfW: null }));
    expect(res.ok).toBe(true);
  });
});

describe("normalizePortrait — Δ12 hard failures (only when the card is impossible)", () => {
  const reject = (a: PortraitAnalysis) => {
    const res = normalizePortrait(a);
    expect(res.ok).toBe(false);
    return res.ok ? null : res.reason;
  };

  it("no primary face", () => {
    expect(reject(fixture({ faces: 0, faceBox: null, eyeY: null, faceCenterX: null }))).toBe(
      "no_face",
    );
  });

  it("multiple significant faces", () => {
    expect(reject(fixture({ faces: 2 }))).toBe("multiple_faces");
  });

  it("head substantially cut off", () => {
    expect(
      reject(fixture({ headTopY: 0.5, faceBox: { x: 300, y: 5, w: 200, h: 200 } })),
    ).toBe("head_cut_off");
  });

  it("genuinely too low resolution", () => {
    expect(reject(fixture({ srcW: 200 }))).toBe("too_low_res");
  });

  it("catastrophic segmentation", () => {
    expect(reject(fixture({ coverage: 0.01 }))).toBe("segmentation_failed");
    expect(reject(fixture({ contentBounds: null }))).toBe("segmentation_failed");
  });

  it("not a chest-up portrait (no silhouette below the chin)", () => {
    expect(reject(fixture({ shoulderY: 250, shoulderHalfW: 220 }))).toBe(
      "normalization_impossible",
    );
  });

  it("face lands outside the perceived-size band", () => {
    expect(
      reject(fixture({ faceBox: { x: 300, y: 150, w: 450, h: 450 } })),
    ).toBe("normalization_impossible");
    expect(
      reject(fixture({ faceBox: { x: 350, y: 150, w: 100, h: 100 }, eyeY: 190 })),
    ).toBe("normalization_impossible");
  });
});

describe("normalizePortrait — Δ12 soft signals never reject", () => {
  it("a dark photo passes with a warning", () => {
    const res = normalizePortrait(fixture({ brightness: 25 }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.warnings.length).toBeGreaterThan(0);
  });

  it("a soft/blurry photo passes with a warning", () => {
    const res = normalizePortrait(fixture({ sharpness: 4 }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.warnings.length).toBeGreaterThan(0);
  });

  it("a normal phone photo passes with no warnings", () => {
    const res = normalizePortrait(fixture());
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.warnings).toEqual([]);
  });
});

describe("cutoutCss", () => {
  it("derives percentage placement from the stored transform", () => {
    const res = normalizePortrait(fixture());
    if (!res.ok) throw new Error("expected ok");
    const css = cutoutCss(res.meta);
    expect(css.left).toBe(`${(res.meta.tx * 100).toFixed(3)}%`);
    expect(css.top).toBe(`${(res.meta.ty * 100).toFixed(3)}%`);
    expect(css.width).toBe(
      `${(((res.meta.srcW * res.meta.scale) / CARD_ASPECT) * 100).toFixed(3)}%`,
    );
  });
});
