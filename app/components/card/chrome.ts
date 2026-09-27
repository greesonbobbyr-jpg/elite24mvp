// Helpers for the small sizes (compact/avatar) and the StaffCard portraits —
// separate compositions with their own local geometry.

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
