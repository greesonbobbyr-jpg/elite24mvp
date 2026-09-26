import type { FinishKey } from "./cardTheme";

/** The supplied plate contains the actual frame, environment and recessed
 * panels in perfect registration. Reuse those exact pixels for foreground
 * occlusion and luminance-driven reflections instead of inventing metal.
 * Built by scripts/card-art.ts from the authored source in design/reference
 * (2× upscale, frame centered, notches mirrored to center, sharpened). */
export type AssetSpec = { file: string; kind: "art"; layer: number; required: boolean };
export const ASSET_PX = { w: 2048, h: 3072 } as const;
export function finishAssets(finish: FinishKey) {
  return { plate: { file: `/card/finishes/${finish}/plate.webp`, kind: "art", layer: 16, required: true } satisfies AssetSpec };
}
export function allAssetsFor(finish: FinishKey): AssetSpec[] { return Object.values(finishAssets(finish)); }
