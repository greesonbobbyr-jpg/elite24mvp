import type { FinishKey } from "./cardTheme";
import { FRAME_CELLS } from "./finishArt";

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
    field: { file: `/card/finishes/${finish}/field.webp`, kind: "art", layer: 13, required: true } satisfies AssetSpec,
  };
}

export function allAssetsFor(finish: FinishKey): AssetSpec[] {
  return Object.values(finishAssets(finish));
}

/** The small sizes' art, cut from the level's plate by scripts/card-art.ts:
 * the avatar ring and the rows' mini frame (a nine-slice). */
export function miniArt(finish: FinishKey) {
  return { ring: `/card/finishes/${finish}/ring.webp`, frame: `/card/finishes/${finish}/frame.webp` };
}

/** Staff cards: the same cuts in graphite. */
export const STAFF_ART = {
  plate: { file: "/card/staff/plate.webp", kind: "art", layer: 16, required: true } satisfies AssetSpec,
  ring: "/card/staff/ring.webp",
  frame: "/card/staff/frame.webp",
};

/** Pixels per cell of the mini frame's nine-slice: FRAME_CELLS.size card
 * units on the 2048-px-wide plate. */
export const FRAME_SLICE = Math.round(FRAME_CELLS.size * 2.048);
