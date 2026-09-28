import type { CSSProperties } from "react";

// Helpers for the StaffCard's circular portraits — separate compositions with
// their own local geometry.

/**
 * Head-crop placement for circular portraits: scales/positions a cutout so
 * the stored face box fills the disc naturally. In percentages of the disc,
 * so the portrait scales with whatever size it's given.
 */
export function headCropStyle(meta: {
  faceBox: { x: number; y: number; w: number; h: number };
  srcW: number;
}): CSSProperties {
  const k = 62 / meta.faceBox.h; // % of the disc per source pixel
  const faceCx = meta.faceBox.x + meta.faceBox.w / 2;
  const faceCy = meta.faceBox.y + meta.faceBox.h * 0.48;
  return {
    position: "absolute",
    width: `${meta.srcW * k}%`,
    left: `${50 - faceCx * k}%`,
    top: `${50 - faceCy * k}%`, // the disc is square: % of its height = % of its width
    maxWidth: "none",
  };
}
