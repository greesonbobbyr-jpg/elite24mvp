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
 * window take separate ramps, and each level's field gets its own swirls so no
 * two levels' currents are identical.
 * Small sizes, per level: ring.webp (the rail's crystal band bent into the
 * avatar ring) and frame.webp (a nine-slice of the corner and rails for the
 * rows), both cut from that level's plate. Staff: public/card/staff/, the same
 * cut from the plate in graphite (STAFF_LOOK).
 * This edits supplied, authored pixels; it never draws metal (Plan v4).
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { FRAME_WINDOW, MASTER_W } from "../lib/cardGeometry";
import {
  FRAME_CELLS,
  LEVEL_LOOKS,
  RING_BAND,
  STAFF_LOOK,
  brightness,
  pixelRecolor,
  swirlSource,
  type Recolor,
  type Swirl,
} from "../lib/finishArt";

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
function recolor(pixels: Buffer, width: number, height: number, channels: number, outside: Recolor, inside?: Recolor, mask?: Buffer): Buffer {
  const outer = pixelRecolor(outside, width, height);
  const inner = inside ? pixelRecolor(inside, width, height) : outer;
  const a = [0, 0, 0];
  const b = [0, 0, 0];
  const out = Buffer.from(pixels);
  for (let i = 0, p = 0; i < pixels.length; i += channels, p++) {
    const x = p % width;
    const y = Math.floor(p / width);
    const w = inside && mask ? mask[p] / 255 : 0;
    outer(pixels[i], pixels[i + 1], pixels[i + 2], x, y, a);
    if (w > 0) inner(pixels[i], pixels[i + 1], pixels[i + 2], x, y, b);
    for (let c = 0; c < 3; c++) out[i + c] = Math.round(w > 0 ? a[c] * (1 - w) + b[c] * w : a[c]);
  }
  return out;
}

/** Twist an image by a level's swirls (bilinear resample). */
function twist(pixels: Buffer, width: number, height: number, channels: number, swirls: Swirl[]): Buffer {
  const unit = width / MASTER_W;
  const out = Buffer.from(pixels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [sx, sy] = swirlSource(x, y, swirls, unit);
      if (sx === x && sy === y) continue;
      const x0 = Math.max(0, Math.min(width - 2, Math.floor(sx)));
      const y0 = Math.max(0, Math.min(height - 2, Math.floor(sy)));
      const fx = Math.max(0, Math.min(1, sx - x0));
      const fy = Math.max(0, Math.min(1, sy - y0));
      const a = (y0 * width + x0) * channels;
      const b = a + channels;
      const c = a + width * channels;
      const d = c + channels;
      const o = (y * width + x) * channels;
      for (let k = 0; k < channels; k++) {
        out[o + k] = Math.round(
          pixels[a + k] * (1 - fx) * (1 - fy) + pixels[b + k] * fx * (1 - fy) + pixels[c + k] * (1 - fx) * fy + pixels[d + k] * fx * fy,
        );
      }
    }
  }
  return out;
}

async function writeWebp(pixels: Buffer, width: number, height: number, channels: 3 | 4, file: string, quality: number) {
  mkdirSync(join(file, ".."), { recursive: true });
  await sharp(pixels, { raw: { width, height, channels } }).webp({ quality, effort: 6 }).toFile(file);
  console.log(`wrote ${file}`);
}

const UNIT = W / MASTER_W; // plate px per card unit

/** Bilinear sample of the plate (RGB) at plate pixel (x, y). */
function samplePlate(plate: Buffer, x: number, y: number, out: number[]) {
  const x0 = Math.max(0, Math.min(W - 2, Math.floor(x)));
  const y0 = Math.max(0, Math.min(H - 2, Math.floor(y)));
  const fx = Math.max(0, Math.min(1, x - x0));
  const fy = Math.max(0, Math.min(1, y - y0));
  const a = (y0 * W + x0) * 3;
  const b = a + 3;
  const c = a + W * 3;
  const d = c + 3;
  for (let k = 0; k < 3; k++) {
    out[k] = plate[a + k] * (1 - fx) * (1 - fy) + plate[b + k] * fx * (1 - fy) + plate[c + k] * (1 - fx) * fy + plate[d + k] * fx * fy;
  }
}

/** The avatar ring: the left rail's crystal band bent into a circle (RGBA).
 * The band runs out and back along the rail, so the ends meet without a seam. */
function ring(plate: Buffer): { pixels: Buffer; size: number } {
  const size = 192;
  const outer = 95;
  const inner = 78;
  const band = RING_BAND;
  const out = Buffer.alloc(size * size * 4);
  const rgb = [0, 0, 0];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - size / 2;
      const dy = y + 0.5 - size / 2;
      const r = Math.hypot(dx, dy);
      const alpha = Math.max(0, Math.min(1, outer + 0.5 - r)) * Math.max(0, Math.min(1, r - (inner - 0.5)));
      if (alpha <= 0) continue;
      const around = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI);
      const along = around < 0.5 ? around * 2 : (1 - around) * 2;
      const across = (outer - r) / (outer - inner);
      samplePlate(plate, (band.x0 + across * (band.x1 - band.x0)) * UNIT, (band.y0 + along * (band.y1 - band.y0)) * UNIT, rgb);
      const o = (y * size + x) * 4;
      out[o] = Math.round(rgb[0]);
      out[o + 1] = Math.round(rgb[1]);
      out[o + 2] = Math.round(rgb[2]);
      out[o + 3] = Math.round(alpha * 255);
    }
  }
  return { pixels: out, size };
}

/** The frame's alpha from a pixel's brightness: the plate's dark backdrop
 * (≤ FRAME_CLEAR) is fully transparent, the metal (≥ FRAME_SOLID) opaque.
 * A softer fade left the backdrop 20–45% opaque — invisible on black, a gray
 * box around every row on a light page (owner, 2026-10-06). */
const FRAME_CLEAR = 40;
const FRAME_SOLID = 90;

/** The rows' mini frame, as a 3×3 nine-slice (RGBA): the plate's corner, top
 * rail and left rail, mirrored for the other sides. Dark pixels are
 * transparent, so only the frame's lines sit over the row. */
function frame(plate: Buffer): { pixels: Buffer; size: number; cell: number } {
  const cell = Math.round(FRAME_CELLS.size * UNIT);
  const size = cell * 3;
  const out = Buffer.alloc(size * size * 4);
  const rgb = [0, 0, 0];
  const pieces: [number, number, { x: number; y: number }, boolean, boolean][] = [
    [0, 0, FRAME_CELLS.corner, false, false], [1, 0, FRAME_CELLS.top, false, false], [2, 0, FRAME_CELLS.corner, true, false],
    [0, 1, FRAME_CELLS.left, false, false], [2, 1, FRAME_CELLS.left, true, false],
    [0, 2, FRAME_CELLS.corner, false, true], [1, 2, FRAME_CELLS.top, false, true], [2, 2, FRAME_CELLS.corner, true, true],
  ];
  for (const [col, row, from, flipX, flipY] of pieces) {
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) {
        const sx = from.x * UNIT + (flipX ? cell - 1 - x : x);
        const sy = from.y * UNIT + (flipY ? cell - 1 - y : y);
        samplePlate(plate, sx, sy, rgb);
        const o = ((row * cell + y) * size + col * cell + x) * 4;
        out[o] = Math.round(rgb[0]);
        out[o + 1] = Math.round(rgb[1]);
        out[o + 2] = Math.round(rgb[2]);
        const lit = (brightness(rgb[0], rgb[1], rgb[2]) - FRAME_CLEAR) / (FRAME_SOLID - FRAME_CLEAR);
        out[o + 3] = Math.round(Math.max(0, Math.min(1, lit)) * 255);
      }
    }
  }
  return { pixels: out, size, cell };
}

/** A level's plate plus the small sizes' ring and mini frame cut from it. */
async function writeArt(dir: string, plate: Buffer, writePlate = true) {
  if (writePlate) await writeWebp(plate, W, H, 3, join(dir, "plate.webp"), 92);
  const r = ring(plate);
  await writeWebp(r.pixels, r.size, r.size, 4, join(dir, "ring.webp"), 92);
  const f = frame(plate);
  await writeWebp(f.pixels, f.size, f.size, 4, join(dir, "frame.webp"), 92);
}

async function main() {
  const mask = await windowMask();
  const plate = await platinumPlate(mask);
  await writeArt(finishDir("platinum"), plate, false);
  const field = await sharp(FIELD_SOURCE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: fw, height: fh } = field.info;
  await writeWebp(field.data, fw, fh, 3, join(finishDir("platinum"), "field.webp"), 90);

  for (const [level, look] of Object.entries(LEVEL_LOOKS)) {
    await writeArt(finishDir(level), recolor(plate, W, H, 3, look.frame, look.window, mask));
    const own = twist(field.data, fw, fh, 3, look.swirls);
    await writeWebp(recolor(own, fw, fh, 3, look.field), fw, fh, 3, join(finishDir(level), "field.webp"), 90);
  }
  await writeArt(join("public", "card", "staff"), recolor(plate, W, H, 3, STAFF_LOOK.frame, STAFF_LOOK.window, mask));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
