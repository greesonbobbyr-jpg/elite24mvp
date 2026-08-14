// Shared geometry-derived CSS for the card chrome (Stage 5). All numbers come
// from lib/cardGeometry — no critical dimension lives here.

import { CARD_ASPECT, FRAME } from "@/lib/cardGeometry";

/**
 * Chamfered-corner clip path (percent-based) for a card-aspect box. `inset` is
 * a fraction of card WIDTH taken off every side (0 = outer frame edge);
 * `chamfer` is the corner cut length along each edge, also width-fraction.
 */
export function chamferClip(inset: number, chamfer: number): string {
  const ix = inset * 100; // width %
  const iy = inset * CARD_ASPECT * 100; // height % (same px as ix)
  const cx = chamfer * 100;
  const cy = chamfer * CARD_ASPECT * 100;
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

/** Outer card silhouette. */
export const CLIP_OUTER = chamferClip(0, FRAME.chamfer);
/** Inner face (inside the metal ring). */
export const CLIP_FACE = chamferClip(FRAME.thickness, FRAME.chamfer * 0.72);
/** Slightly inside the face — used for bevel edge lines. */
export const CLIP_BEVEL = chamferClip(FRAME.thickness + FRAME.bevel, FRAME.chamfer * 0.68);
