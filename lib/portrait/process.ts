// The client portrait pipeline (photo pipeline A): file → capped original +
// background-removed cutout + metadata, all as data: URLs ready for the form.
//
// FAILURE BEHAVIOR (Δ5): card creation REJECTS — any failure in reading,
// segmentation, or (Stage 4) validation/normalization returns { error } with
// the rejection copy and the caller stores NOTHING. A bad upload never
// silently becomes a finished initials card. (UI fallbacks for players who
// simply have no photo yet live in the render layer, not here.)
//
// Browser-only (canvas/Image); server re-validates everything it receives.

import { readImage, encode, dataUrlBytes, MAX_BYTES } from "@/lib/clientImage";
import { segmentPhoto, type SegmentProgress } from "./segment";

/** §16 rejection copy — the exact sentence the player sees. */
export const PORTRAIT_REJECT_MESSAGE =
  "We couldn't create your Player Card from this photo. Upload a clear " +
  "chest-up photo facing the camera with your full head and shoulders visible.";

/** Longest edge fed into segmentation (quality > the stored 512px original). */
const SEGMENT_DIM = 1024;
/** Longest edge of the stored cutout. */
const CUTOUT_DIM = 768;
/** Byte cap for the stored cutout data URL (alpha PNGs run larger). */
export const MAX_CUTOUT_BYTES = 600 * 1024;

export type PortraitMeta = {
  /** Pipeline version; Stage 4 (normalization) bumps this and extends fields. */
  version: 1;
  /** Source photo dimensions as segmented. */
  srcW: number;
  srcH: number;
};

export type PortraitResult =
  | { originalUrl: string; cutoutUrl: string; meta: PortraitMeta }
  | { error: string };

export type PortraitPhase = "reading" | "removing" | "finishing";

/** Encode a canvas-drawable to an alpha-capable data URL under a byte cap. */
function encodeCutout(img: HTMLImageElement, max: number, quality: number): string {
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(img, 0, 0, w, h);
  // WebP keeps alpha and compresses well; browsers without a webp encoder
  // (older Safari) silently return PNG from toDataURL — also alpha-safe.
  return canvas.toDataURL("image/webp", quality);
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("cutout decode failed"));
    };
    img.src = url;
  });
}

/**
 * Full pipeline A for one chosen file (or a re-cut of a stored original
 * passed as a Blob). Reports coarse progress for the upload UX.
 */
export async function processPortrait(
  file: Blob,
  onProgress?: (phase: PortraitPhase, fraction: number) => void,
): Promise<PortraitResult> {
  try {
    onProgress?.("reading", 0);
    if (file instanceof File && !file.type.startsWith("image/")) {
      return { error: "Please choose an image file." };
    }
    const img = await readImage(file as File);

    // The stored ORIGINAL — same cap as every other stored image; the original
    // is never overwritten by the cutout and is kept for future re-cuts.
    let originalUrl = encode(img, 512, 0.85);
    if (originalUrl && dataUrlBytes(originalUrl) > MAX_BYTES) {
      originalUrl = encode(img, 320, 0.7);
    }
    if (!originalUrl || dataUrlBytes(originalUrl) > MAX_BYTES) {
      return { error: "That image is too large. Try a smaller one." };
    }

    // Segment at higher resolution than we store — edge quality lives here.
    onProgress?.("removing", 0);
    const segInput = encode(img, SEGMENT_DIM, 0.92);
    const cutoutBlob = await segmentPhoto(segInput, (f) =>
      onProgress?.("removing", f),
    );

    onProgress?.("finishing", 0);
    const cutoutImg = await blobToImage(cutoutBlob);
    let cutoutUrl = encodeCutout(cutoutImg, CUTOUT_DIM, 0.9);
    if (cutoutUrl && dataUrlBytes(cutoutUrl) > MAX_CUTOUT_BYTES) {
      cutoutUrl = encodeCutout(cutoutImg, 512, 0.8);
    }
    if (!cutoutUrl || dataUrlBytes(cutoutUrl) > MAX_CUTOUT_BYTES) {
      return { error: PORTRAIT_REJECT_MESSAGE };
    }

    const meta: PortraitMeta = {
      version: 1,
      srcW: cutoutImg.width,
      srcH: cutoutImg.height,
    };
    onProgress?.("finishing", 1);
    return { originalUrl, cutoutUrl, meta };
  } catch {
    // Segmentation/decoding failure → the card is not created (Δ5).
    return { error: PORTRAIT_REJECT_MESSAGE };
  }
}
