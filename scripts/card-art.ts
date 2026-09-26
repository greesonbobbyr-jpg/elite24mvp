/**
 * CARD ART PIPELINE — builds the served card artwork from the authored source
 * art, deterministically. Re-run whenever a source image or a level look
 * (lib/finishArt.ts) changes:
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
 * Platinum field: design/reference/platinum-field-source.png (the energy
 * derived from the approved B3 reference) → finishes/platinum/field.webp (q90).
 * Bronze / Silver / Gold / Diamond: the finished Platinum plate and field,
 * recolored through each level's look (lib/finishArt.ts); the plate's frame and
 * window take separate ramps.
 * This edits supplied, authored pixels; it never draws metal (Plan v4).
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { FRAME_WINDOW, MASTER_W } from "../lib/cardGeometry";
import { LEVEL_LOOKS, brightness, rampTable, recolorChannel, type Recolor } from "../lib/finishArt";

const PLATE_SOURCE = join("design", "reference", "platinum-plate-source.png");
const FIELD_SOURCE = join("design", "reference", "platinum-field-source.png");
const finishDir = (level: string) => join("public", "card", "finishes", level);

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

/** Inside the frame window = 255. */
async function windowMask(): Promise<Buffer> {
  const unit = W / MASTER_W;
  return sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
        `<rect width="100%" height="100%" fill="black"/>` +
        `<path d="${FRAME_WINDOW}" transform="scale(${unit})" fill="white"/></svg>`,
    ),
  )
    .greyscale()
    .raw()
    .toBuffer();
}

/** Builds and writes the Platinum plate; returns its finished pixels (RGB). */
async function platinumPlate(mask: Buffer): Promise<Buffer> {
  const upscaled = await sharp(PLATE_SOURCE)
    .removeAlpha()
    .resize(W, H, { kernel: "lanczos3" })
    .raw()
    .toBuffer();

  // 1–2. Center the frame: shift right; the vacated strip stays black.
  const centered = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    upscaled.copy(centered, (y * W + SHIFT) * 3, y * W * 3, (y * W + W - SHIFT) * 3);
  }

  // 3. Mirror left → right on the top and bottom borders; the window is never touched.
  const out = Buffer.from(centered);
  for (let y = 0; y < H; y++) {
    const wy = rowWeight(y / SCALE);
    if (wy === 0) continue;
    for (let x = W / 2; x < W; x++) {
      if (mask[y * W + x] > 127) continue;
      const w = wy * columnWeight(x);
      if (w === 0) continue;
      const o = (y * W + x) * 3;
      const m = (y * W + (W - 1 - x)) * 3;
      for (let c = 0; c < 3; c++) out[o + c] = Math.round(centered[o + c] * (1 - w) + centered[m + c] * w);
    }
  }

  // 4. Sharpen the bevels, then save.
  const finished = await sharp(out, { raw: { width: W, height: H, channels: 3 } })
    .sharpen({ sigma: 1.3, m1: 0.8, m2: 3.0 })
    .raw()
    .toBuffer();
  await writeWebp(finished, W, H, 3, join(finishDir("platinum"), "plate.webp"), 92);
  return finished;
}

/** Recolor RGB(A) pixels; `mask` (0..255) blends from `outside` to `inside`. */
function recolor(pixels: Buffer, channels: number, outside: Recolor, inside?: Recolor, mask?: Buffer): Buffer {
  const outsideTable = rampTable(outside.ramp);
  const insideTable = inside ? rampTable(inside.ramp) : outsideTable;
  const out = Buffer.from(pixels);
  for (let i = 0, p = 0; i < pixels.length; i += channels, p++) {
    const level = brightness(pixels[i], pixels[i + 1], pixels[i + 2]);
    const w = inside && mask ? mask[p] / 255 : 0;
    for (let c = 0; c < 3; c++) {
      const a = recolorChannel(outsideTable, level, c, pixels[i + c], outside);
      const b = w > 0 && inside ? recolorChannel(insideTable, level, c, pixels[i + c], inside) : a;
      out[i + c] = Math.round(a * (1 - w) + b * w);
    }
  }
  return out;
}

async function writeWebp(pixels: Buffer, width: number, height: number, channels: 3 | 4, file: string, quality: number) {
  mkdirSync(join(file, ".."), { recursive: true });
  await sharp(pixels, { raw: { width, height, channels } }).webp({ quality, effort: 6 }).toFile(file);
  console.log(`wrote ${file}`);
}

async function main() {
  const mask = await windowMask();
  const plate = await platinumPlate(mask);
  const field = await sharp(FIELD_SOURCE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: fw, height: fh } = field.info;
  await writeWebp(field.data, fw, fh, 3, join(finishDir("platinum"), "field.webp"), 90);

  for (const [level, look] of Object.entries(LEVEL_LOOKS)) {
    await writeWebp(recolor(plate, 3, look.frame, look.window, mask), W, H, 3, join(finishDir(level), "plate.webp"), 92);
    await writeWebp(recolor(field.data, 3, look.field), fw, fh, 3, join(finishDir(level), "field.webp"), 90);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
