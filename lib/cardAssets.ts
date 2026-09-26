import type { FinishKey } from "./cardTheme";

/** The supplied plate contains the actual frame, environment and recessed
 * panels in perfect registration. Reuse those exact pixels for foreground
 * occlusion and luminance-driven reflections instead of inventing metal. */
export type AssetSpec = { file: string; kind: "art"; layer: number; required: boolean };
export const ASSET_PX = { w: 1024, h: 1536 } as const;
export function finishAssets(finish: FinishKey) {
  return { plate: { file: `/card/finishes/${finish}/plate.png`, kind: "art", layer: 16, required: true } satisfies AssetSpec };
}
export function allAssetsFor(finish: FinishKey): AssetSpec[] { return Object.values(finishAssets(finish)); }
