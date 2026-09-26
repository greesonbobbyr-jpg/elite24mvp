/**
 * CARD ART PIPELINE — builds the served card artwork from the authored source
 * art, deterministically. Re-run whenever a source image changes:
 *
 *   npx tsx scripts/card-art.ts
 *
 * Platinum plate: design/reference/platinum-plate-source.png (1024×1536, cut
 * from the owner's card art) → public/card/finishes/platinum/plate.webp
 *   1. 2× Lanczos upscale (2048×3072). Phones draw the card at ~1500 device px
 *      wide; the browser's own stretch of the 1024px art looked soft.
 *   2. Center the frame in the canvas. The source frame's outer rails are
 *      symmetric about x = 504.25, not 512.
 *   3. Mirror the top and bottom borders so their notches are centered (owner
 *      review, 2026-09-26). Frame pixels only — never the window background
 *      (FRAME_WINDOW) or the stat boxes. Seams are feathered, and the original
 *      texture runs through the middle so there's no mirror point.
 *   4. Sharpen, then WebP (q92, ~0.9 MB).
 * This edits supplied, authored pixels; it never draws metal (Plan v4).
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { FRAME_WINDOW, MASTER_W } from "../lib/cardGeometry";

const SOURCE = join("design", "reference", "platinum-plate-source.png");
const TARGET = join("public", "card", "finishes", "platinum", "plate.webp");

const SCALE = 2;
const W = 1024 * SCALE;
const H = 1536 * SCALE;
const FRAME_AXIS_1X = 504.25; // measured from the source's outer rails
const SHIFT = Math.round((512 - FRAME_AXIS_1X) * SCALE);
// Rows (source px) whose right half is mirrored from the left half.
const TOP_END = 250; // top border + corners
const BOTTOM_START = 1416; // below the stat boxes
const FEATHER = 24;
// Where, right of center, the original texture hands over to the mirrored one
// (both are plain bar there; the source bars run to ~1206px at 2x).
const KEEP_END = W / 2 + 86;
const HANDOVER_END = W / 2 + 166;

function rowWeight(sourceY: number): number {
  if (sourceY < TOP_END) return 1;
  if (sourceY < TOP_END + FEATHER) return 1 - (sourceY - TOP_END) / FEATHER;
  if (sourceY >= BOTTOM_START + FEATHER) return 1;
  if (sourceY >= BOTTOM_START) return (sourceY - BOTTOM_START) / FEATHER;
  return 0;
}

function columnWeight(x: number): number {
  if (x < KEEP_END) return 0;
  if (x < HANDOVER_END) return (x - KEEP_END) / (HANDOVER_END - KEEP_END);
  return 1;
}

async function platinumPlate() {
  const upscaled = await sharp(SOURCE)
    .removeAlpha()
    .resize(W, H, { kernel: "lanczos3" })
    .raw()
    .toBuffer();

  // 1–2. Center the frame: shift right; the vacated strip stays black.
  const centered = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    upscaled.copy(centered, (y * W + SHIFT) * 3, y * W * 3, (y * W + W - SHIFT) * 3);
  }

  // The window (inside = white) is never touched.
  const unit = W / MASTER_W;
  const windowMask = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
        `<rect width="100%" height="100%" fill="black"/>` +
        `<path d="${FRAME_WINDOW}" transform="scale(${unit})" fill="white"/></svg>`,
    ),
  )
    .greyscale()
    .raw()
    .toBuffer();

  // 3. Mirror left → right on the top and bottom borders.
  const out = Buffer.from(centered);
  for (let y = 0; y < H; y++) {
    const wy = rowWeight(y / SCALE);
    if (wy === 0) continue;
    for (let x = W / 2; x < W; x++) {
      if (windowMask[y * W + x] > 127) continue;
      const w = wy * columnWeight(x);
      if (w === 0) continue;
      const o = (y * W + x) * 3;
      const m = (y * W + (W - 1 - x)) * 3;
      for (let c = 0; c < 3; c++) out[o + c] = Math.round(centered[o + c] * (1 - w) + centered[m + c] * w);
    }
  }

  // 4. Sharpen the bevels, then save.
  mkdirSync(join("public", "card", "finishes", "platinum"), { recursive: true });
  await sharp(out, { raw: { width: W, height: H, channels: 3 } })
    .sharpen({ sigma: 1.3, m1: 0.8, m2: 3.0 })
    .webp({ quality: 92, effort: 6 })
    .toFile(TARGET);
  console.log(`wrote ${TARGET} (${W}×${H})`);
}

platinumPlate().catch((e) => {
  console.error(e);
  process.exit(1);
});
