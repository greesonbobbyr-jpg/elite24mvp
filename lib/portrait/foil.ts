import type { PortraitMetaV2 } from "./normalize";

export type CardPoint = { x: number; y: number };

const ALPHA_ON = 110;
/** How far the root sits outward from the neck (or the hair over it), in face
 * widths: out on top of the shoulder, where the approved B3 energy erupts. */
const ROOT_OUT = 0.3;
/** How far below the chin to look for the shoulder, in face heights. */
const SCAN_DEPTH = 1.5;

/** Find the top of each shoulder, where the authored energy should come out
 * of the player. Scanning down from the chin, the silhouette edge holds near
 * the neck (or hair hanging over it), then turns outward: the shoulder. Each
 * root is where the edge has moved ROOT_OUT face widths past its innermost
 * point above the shoulder line. Anchoring at the chin instead left the energy
 * floating beside the hair (owner review, 2026-09-26).
 * Input alpha can be downsampled; output is in the card's 1000 x 1500 units. */
export function shoulderRoots(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  meta: PortraitMetaV2,
): { left: CardPoint; right: CardPoint } | null {
  const k = width / meta.srcW; // sampled px per source px
  const chin = Math.max(0, Math.round((meta.faceBox.y + meta.faceBox.h) * k));
  const shoulderLine = Math.max(chin, Math.round(meta.shoulderY * k));
  const last = Math.min(height - 1, Math.round(chin + meta.faceBox.h * k * SCAN_DEPTH));
  const out = meta.faceBox.w * k * ROOT_OUT;
  const toCard = (x: number, y: number): CardPoint => ({
    x: meta.tx * 1000 + (x / k) * meta.scale * 1500,
    y: meta.ty * 1500 + (y / k) * meta.scale * 1500,
  });

  const root = (side: -1 | 1) => {
    // Outward distance from the card's center: larger = further out.
    const outward = (x: number) => side * x;
    const edges: (number | null)[] = [];
    for (let y = chin; y <= last; y++) {
      let x: number | null = null;
      if (side < 0) {
        for (let i = 0; i < width; i++) if (pixels[(y * width + i) * 4 + 3] >= ALPHA_ON) { x = i; break; }
      } else {
        for (let i = width - 1; i >= 0; i--) if (pixels[(y * width + i) * 4 + 3] >= ALPHA_ON) { x = i; break; }
      }
      edges.push(x);
    }
    // The neck, or the hair over it: the innermost edge down to the shoulder line.
    let inner = Infinity;
    let innerRow = -1;
    for (let y = chin; y <= Math.min(shoulderLine, last); y++) {
      const x = edges[y - chin];
      if (x != null && outward(x) <= inner) { inner = outward(x); innerRow = y; }
    }
    if (innerRow < 0) return null;
    for (let y = innerRow; y <= last; y++) {
      const x = edges[y - chin];
      if (x != null && outward(x) - inner >= out) return toCard(x, y);
    }
    return null;
  };

  const left = root(-1);
  const right = root(1);
  return left && right ? { left, right } : null;
}
