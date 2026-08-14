// Shared geometry-derived CSS for the card chrome (Stage 5). All numbers come
// from lib/cardGeometry — no critical dimension lives here.

import { CARD_ASPECT, FRAME } from "@/lib/cardGeometry";

/**
 * Chamfered-corner clip path (percent-based) for a box of the given aspect
 * (width/height; defaults to the full card). `inset` is a fraction of box
 * WIDTH taken off every side (0 = outer frame edge); `chamfer` is the corner
 * cut length along each edge, also width-fraction.
 */
export function chamferClip(
  inset: number,
  chamfer: number,
  aspect: number = CARD_ASPECT,
): string {
  const ix = inset * 100; // width %
  const iy = inset * aspect * 100; // height % (same px as ix)
  const cx = chamfer * 100;
  const cy = chamfer * aspect * 100;
  const R = 100;
  const pts = [
    [ix + cx, iy],
    [R - ix - cx, iy],
    [R - ix, iy + cy],
    [R - ix, R - iy - cy],
    [R - ix - cx, R - iy],
    [ix + cx, R - iy],
    [ix, R - iy - cy],
    [ix, iy + cy],
  ];
  return `polygon(${pts.map(([x, y]) => `${x.toFixed(3)}% ${y.toFixed(3)}%`).join(", ")})`;
}

/**
 * Head-crop placement for circular portraits: scales/positions a cutout so
 * the stored face box fills a disc of `disc` px naturally. Shared by the
 * player avatar and the staff circular portrait.
 */
export function headCropStyle(
  meta: { faceBox: { x: number; y: number; w: number; h: number }; srcW: number },
  disc: number,
): { position: "absolute"; width: number; left: number; top: number; maxWidth: "none" } {
  const k = (disc * 0.62) / meta.faceBox.h;
  const faceCx = meta.faceBox.x + meta.faceBox.w / 2;
  const faceCy = meta.faceBox.y + meta.faceBox.h * 0.48;
  return {
    position: "absolute",
    width: meta.srcW * k,
    left: disc / 2 - faceCx * k,
    top: disc * 0.5 - faceCy * k,
    maxWidth: "none",
  };
}

/** Outer card silhouette. */
export const CLIP_OUTER = chamferClip(0, FRAME.chamfer);
/** Inner face (inside the metal ring). */
export const CLIP_FACE = chamferClip(FRAME.thickness, FRAME.chamfer * 0.72);
/** Slightly inside the face — used for bevel edge lines. */
export const CLIP_BEVEL = chamferClip(FRAME.thickness + FRAME.bevel, FRAME.chamfer * 0.68);
