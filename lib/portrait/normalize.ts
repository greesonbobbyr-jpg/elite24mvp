// PORTRAIT NORMALIZATION (Stage 4, §12–17) — the pure math. No browser APIs:
// everything here is deterministic and unit-testable against synthetic
// fixtures. The browser half (lib/portrait/analyze.ts) produces a
// PortraitAnalysis from the cutout; this module turns it into the transform
// that places the athlete into the card's PORTRAIT SAFE ZONE — the photo is
// fitted to the locked geometry, never the geometry to the photo.
//
// ANCHORING (§13): landmarks PRIMARY (eye line from the face detector),
// alpha-map SECONDARY (head top + shoulder line from the cutout silhouette),
// never alpha-bounds-only. The scale anchors the EYE→SHOULDER span — the two
// most identity-stable lines — so hair volume and clothing never shrink the
// athlete (Δ8 watchlist).
//
// VALIDATION (Δ12 — START CONSERVATIVE): HARD FAIL only when a professional
// card genuinely cannot be produced; brightness/blur are SOFT SIGNALS with
// permissive thresholds, never gates. A normal phone photo must never be
// rejected over an arbitrary score.

import { CARD_ASPECT, PORTRAIT } from "@/lib/cardGeometry";

export type FaceBox = { x: number; y: number; w: number; h: number };

/** Everything the browser analyzer measures, in CUTOUT pixel coordinates. */
export type PortraitAnalysis = {
  srcW: number;
  srcH: number;
  /** Count of SIGNIFICANT faces (≥40% of the primary's height). */
  faces: number;
  faceBox: FaceBox | null;
  /** Average eye-line Y (landmarks). */
  eyeY: number | null;
  /** Horizontal face center (landmarks). */
  faceCenterX: number | null;
  /** First opaque row (alpha map) — top of hair. */
  headTopY: number | null;
  /** Shoulder line + half-width (alpha map, below the chin). */
  shoulderY: number | null;
  shoulderHalfW: number | null;
  /** Opaque bounding box (alpha map). */
  contentBounds: { top: number; left: number; right: number; bottom: number } | null;
  /** Opaque coverage 0..1 of the whole frame. */
  coverage: number;
  /** Mean luma (0–255) of opaque pixels — SOFT signal only. */
  brightness: number | null;
  /** Laplacian variance — SOFT signal only. */
  sharpness: number | null;
};

/** The stored transform: card units (x = card-width fractions, y = card-height fractions). */
export type PortraitTransform = {
  /** Card-HEIGHT fraction per source pixel (uniform; aspect always preserved). */
  scale: number;
  /** Cutout left edge in card-width fractions. */
  tx: number;
  /** Cutout top edge in card-height fractions. */
  ty: number;
};

export type PortraitMetaV2 = PortraitTransform & {
  version: 2;
  srcW: number;
  srcH: number;
  faceBox: FaceBox;
  eyeY: number;
  headTopY: number;
  shoulderY: number;
};

export type NormalizeResult =
  | { ok: true; meta: PortraitMetaV2; warnings: string[] }
  | { ok: false; reason: RejectReason };

export type RejectReason =
  | "no_face"
  | "multiple_faces"
  | "head_cut_off"
  | "too_low_res"
  | "segmentation_failed"
  | "normalization_impossible";

// Conservative hard-fail floors (Δ12) — tuned only with real stress-test data.
const MIN_SOURCE_EDGE = 280; // px — genuinely too low to print a card face
const MIN_COVERAGE = 0.04; // catastrophic cutout: almost nothing survived
/** Perceived face-height band on the card (card-height fractions). The
 * reference master's face ≈ 0.14; outside this band the card stops reading
 * as the same product. */
const FACE_BAND: [number, number] = [0.085, 0.21];
// SOFT-signal thresholds — deliberately permissive.
const SOFT_DARK_LUMA = 38;
const SOFT_BLUR_VARIANCE = 12;

/**
 * Compute the normalization transform + validation verdict for one analyzed
 * cutout. Deterministic; the returned meta re-renders the card identically
 * forever (§17).
 */
export function normalizePortrait(a: PortraitAnalysis): NormalizeResult {
  // ---- HARD FAILURES (Δ12: only when a professional card is impossible) ----
  if (a.srcW < MIN_SOURCE_EDGE || a.srcH < MIN_SOURCE_EDGE) {
    return { ok: false, reason: "too_low_res" };
  }
  if (!a.contentBounds || a.coverage < MIN_COVERAGE) {
    return { ok: false, reason: "segmentation_failed" };
  }
  if (a.faces === 0 || !a.faceBox || a.eyeY == null || a.faceCenterX == null) {
    return { ok: false, reason: "no_face" };
  }
  if (a.faces > 1) {
    return { ok: false, reason: "multiple_faces" };
  }
  // Head substantially cut off: the face box (not just hair) leaves the frame.
  const face = a.faceBox;
  if (face.y < -face.h * 0.1 || face.y + face.h * 0.25 < 0) {
    return { ok: false, reason: "head_cut_off" };
  }
  const headTopY = a.headTopY ?? Math.max(0, face.y - face.h * 0.45);
  // Face box touching the very top row with no hair above = crown clipped.
  if (headTopY <= 1 && face.y < face.h * 0.12) {
    return { ok: false, reason: "head_cut_off" };
  }
  // Shoulder line: alpha-derived, else a face-proportional estimate (landmarks
  // primary, alpha secondary — the estimate keeps borderline cutouts usable).
  const shoulderY = a.shoulderY ?? face.y + face.h * 2.1;
  if (shoulderY <= a.eyeY + face.h * 0.4) {
    // Silhouette never widens below the chin — not a chest-up portrait.
    return { ok: false, reason: "normalization_impossible" };
  }

  // ---- TRANSFORM (eye→shoulder anchored) -----------------------------------
  let scale = (PORTRAIT.shoulderY - PORTRAIT.eyeY) / (shoulderY - a.eyeY);

  // Clamp 1: the whole head (hair included) must stay inside the safe zone.
  const headRoom = a.eyeY - headTopY; // px above the eye line
  if (headRoom > 0) {
    const maxScaleForHead = (PORTRAIT.eyeY - PORTRAIT.zone.y) / headRoom;
    scale = Math.min(scale, maxScaleForHead);
  }
  // Clamp 2: shoulder span may not exceed the zone's max width.
  if (a.shoulderHalfW != null && a.shoulderHalfW > 0) {
    const maxScaleForWidth =
      (PORTRAIT.maxW * CARD_ASPECT) / (a.shoulderHalfW * 2);
    scale = Math.min(scale, maxScaleForWidth);
  }
  if (!Number.isFinite(scale) || scale <= 0) {
    return { ok: false, reason: "normalization_impossible" };
  }

  // Eye line anchors vertically; the FACE center (never the torso centroid)
  // anchors horizontally, so off-center framing self-corrects.
  const ty = PORTRAIT.eyeY - a.eyeY * scale;
  const tx = PORTRAIT.centerX - (a.faceCenterX * scale) / CARD_ASPECT;

  // ---- CONSISTENCY BAND (Δ8: perceived head size must hold) ---------------
  const mappedFaceH = face.h * scale;
  if (mappedFaceH < FACE_BAND[0] || mappedFaceH > FACE_BAND[1]) {
    return { ok: false, reason: "normalization_impossible" };
  }

  // ---- SOFT SIGNALS (never gates) -----------------------------------------
  const warnings: string[] = [];
  if (a.brightness != null && a.brightness < SOFT_DARK_LUMA) {
    warnings.push("This photo is quite dark — better lighting will look sharper on the card.");
  }
  if (a.sharpness != null && a.sharpness < SOFT_BLUR_VARIANCE) {
    warnings.push("This photo looks a little blurry — a steadier shot will look cleaner.");
  }

  return {
    ok: true,
    warnings,
    meta: {
      version: 2,
      srcW: a.srcW,
      srcH: a.srcH,
      faceBox: face,
      eyeY: a.eyeY,
      headTopY,
      shoulderY,
      scale,
      tx,
      ty,
    },
  };
}

/**
 * CSS placement for a normalized cutout inside a card-aspect container:
 * percentage left/top/width (height follows the image's own aspect).
 * Shared by the card renderer and the portrait debug view — one math.
 */
export function cutoutCss(meta: PortraitTransform & { srcW: number }): {
  left: string;
  top: string;
  width: string;
} {
  const widthFrac = (meta.srcW * meta.scale) / CARD_ASPECT;
  return {
    left: `${(meta.tx * 100).toFixed(3)}%`,
    top: `${(meta.ty * 100).toFixed(3)}%`,
    width: `${(widthFrac * 100).toFixed(3)}%`,
  };
}

/** Type guard for stored photoMeta values produced by this pipeline. */
export function isPortraitMetaV2(v: unknown): v is PortraitMetaV2 {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    m.version === 2 &&
    typeof m.scale === "number" &&
    typeof m.tx === "number" &&
    typeof m.ty === "number" &&
    typeof m.srcW === "number"
  );
}
