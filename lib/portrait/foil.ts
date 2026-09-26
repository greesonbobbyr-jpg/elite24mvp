import type { PortraitMetaV2 } from "./normalize";

/** Locate the two silhouette edges at the neck-to-shoulder transition.
 * Input alpha can be downsampled; output is in the card's 1000 x 1500 units. */
export function foilRoots(pixels: Uint8ClampedArray, width: number, height: number, meta: PortraitMetaV2) {
  const scale = width / meta.srcW;
  const row = Math.min(height - 1, Math.max(0, Math.round((meta.faceBox.y + meta.faceBox.h * 1.1) * scale)));
  let left = 0, right = width - 1;
  while (left < right && pixels[(row * width + left) * 4 + 3] < 110) left++;
  while (right > left && pixels[(row * width + right) * 4 + 3] < 110) right--;
  if (left === right) return null;
  const cardX = (x: number) => meta.tx * 1000 + x / scale * meta.scale * 1500;
  return { left: cardX(left), right: cardX(right), y: meta.ty * 1500 + row / scale * meta.scale * 1500 };
}
