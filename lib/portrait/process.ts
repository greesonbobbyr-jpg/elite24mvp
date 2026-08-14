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
import { segmentPhoto } from "./segment";
import { analyzePortrait } from "./analyze";
import {
  normalizePortrait,
  type PortraitAnalysis,
  type PortraitMetaV2,
  type RejectReason,
} from "./normalize";

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

export type PortraitResult =
  | {
      originalUrl: string;
      cutoutUrl: string;
      meta: PortraitMetaV2;
      /** Δ12 SOFT signals — shown as notes, never rejections. */
      warnings: string[];
    }
  | { error: string; reason?: RejectReason };

export type PortraitPhase = "reading" | "removing" | "analyzing" | "finishing";

/** Intermediate stages, captured only for the dev portrait debug view (Δ6). */
export type PortraitDebug = {
  originalUrl?: string;
  cutoutUrl?: string;
  analysis?: PortraitAnalysis;
  meta?: PortraitMetaV2;
  rejectReason?: RejectReason;
};

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
  debug?: PortraitDebug,
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
    if (debug) debug.originalUrl = originalUrl;

    // Segment at higher resolution than we store — edge quality lives here.
    onProgress?.("removing", 0);
    const segInput = encode(img, SEGMENT_DIM, 0.92);
    const cutoutBlob = await segmentPhoto(segInput, (f) =>
      onProgress?.("removing", f),
    );

    // Measure the cutout, then validate + compute the normalization transform
    // (Stage 4). ANY hard failure rejects the whole upload (Δ5).
    onProgress?.("analyzing", 0);
    const cutoutImg = await blobToImage(cutoutBlob);
    const analysis = await analyzePortrait(cutoutImg);
    if (debug) debug.analysis = analysis;

    let cutoutUrl = encodeCutout(cutoutImg, CUTOUT_DIM, 0.9);
    if (cutoutUrl && dataUrlBytes(cutoutUrl) > MAX_CUTOUT_BYTES) {
      cutoutUrl = encodeCutout(cutoutImg, 512, 0.8);
    }
    if (!cutoutUrl || dataUrlBytes(cutoutUrl) > MAX_CUTOUT_BYTES) {
      return { error: PORTRAIT_REJECT_MESSAGE };
    }
    if (debug) debug.cutoutUrl = cutoutUrl;

    // The stored cutout may have been downscaled from the analyzed raster —
    // rescale the measurements so the meta matches the STORED image.
    const storedImgScale = await storedScale(cutoutUrl, cutoutImg);
    const scaled = rescaleAnalysis(analysis, storedImgScale);

    const verdict = normalizePortrait(scaled);
    if (!verdict.ok) {
      if (debug) debug.rejectReason = verdict.reason;
      return { error: PORTRAIT_REJECT_MESSAGE, reason: verdict.reason };
    }
    if (debug) debug.meta = verdict.meta;

    onProgress?.("finishing", 1);
    return {
      originalUrl,
      cutoutUrl,
      meta: verdict.meta,
      warnings: verdict.warnings,
    };
  } catch {
    // Segmentation/decoding failure → the card is not created (Δ5).
    return { error: PORTRAIT_REJECT_MESSAGE };
  }
}

/** Ratio between the STORED cutout's width and the analyzed image's width. */
async function storedScale(
  storedUrl: string,
  analyzed: HTMLImageElement,
): Promise<number> {
  return new Promise((resolve) => {
    const probe = new Image();
    probe.onload = () => resolve(probe.width / analyzed.width);
    probe.onerror = () => resolve(1);
    probe.src = storedUrl;
  });
}

function rescaleAnalysis(a: PortraitAnalysis, k: number): PortraitAnalysis {
  if (k === 1) return a;
  const n = (v: number | null) => (v == null ? null : v * k);
  return {
    ...a,
    srcW: Math.round(a.srcW * k),
    srcH: Math.round(a.srcH * k),
    faceBox: a.faceBox
      ? { x: a.faceBox.x * k, y: a.faceBox.y * k, w: a.faceBox.w * k, h: a.faceBox.h * k }
      : null,
    eyeY: n(a.eyeY),
    faceCenterX: n(a.faceCenterX),
    headTopY: n(a.headTopY),
    shoulderY: n(a.shoulderY),
    shoulderHalfW: n(a.shoulderHalfW),
    contentBounds: a.contentBounds
      ? {
          top: a.contentBounds.top * k,
          left: a.contentBounds.left * k,
          right: a.contentBounds.right * k,
          bottom: a.contentBounds.bottom * k,
        }
      : null,
  };
}
