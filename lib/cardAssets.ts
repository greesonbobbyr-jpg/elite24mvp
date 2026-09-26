import type { FinishKey } from "./cardTheme";

/** A full-canvas authored image (1000x1500 units). A missing required file
 * renders the ASSET MISSING state, never a drawn substitute. */
export type AssetSpec = { file: string; kind: "art"; layer: number; required: boolean };

/** A level's authored art, built by scripts/card-art.ts (see
 * public/card/README.md):
 * - plate: the frame, background and recessed stat panels in registration;
 *   also reused for foreground occlusion and frame reflections.
 * - field: the energy currents behind the number, attached to the player's
 *   shoulders and clipped into the jersey number. */
export function finishAssets(finish: FinishKey) {
  return {
    plate: { file: `/card/finishes/${finish}/plate.webp`, kind: "art", layer: 16, required: true } satisfies AssetSpec,
    field: { file: `/card/finishes/${finish}/field.png`, kind: "art", layer: 13, required: true } satisfies AssetSpec,
  };
}

export function allAssetsFor(finish: FinishKey): AssetSpec[] {
  return Object.values(finishAssets(finish));
}
