// The browser half of portrait normalization (Stage 4): measures a cutout —
// face landmarks via MediaPipe FaceDetector (self-hosted wasm + model under
// /face/), silhouette lines via the cutout's ALPHA MAP (row-wise opaque-width
// analysis below the chin), plus soft quality signals. Landmarks primary,
// alpha secondary, never alpha-bounds-only (§13). Runs entirely on-device.

import type { FaceBox, PortraitAnalysis } from "./normalize";

/** Analysis raster cap — measurements scale back to cutout pixels. */
const ANALYZE_DIM = 512;
/** A pixel counts as "opaque" above this alpha. */
const ALPHA_ON = 64;
/** Secondary detections at least this fraction of the primary's height count
 * as a second SIGNIFICANT face (Δ12: incidental background faces don't). */
const SIGNIFICANT_FACE = 0.4;

type Detector = {
  detect: (img: HTMLCanvasElement) => {
    detections: {
      boundingBox?: { originX: number; originY: number; width: number; height: number };
      keypoints: { x: number; y: number }[];
    }[];
  };
};

let detectorPromise: Promise<Detector> | null = null;

function loadDetector(): Promise<Detector> {
  detectorPromise ??= (async () => {
    const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks("/face/wasm");
    return FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "/face/blaze_face_short_range.tflite" },
      runningMode: "IMAGE",
      minDetectionConfidence: 0.5,
    }) as Promise<Detector>;
  })();
  return detectorPromise;
}

/** Measure a decoded cutout image. All outputs in CUTOUT pixel coordinates. */
export async function analyzePortrait(
  cutout: HTMLImageElement,
): Promise<PortraitAnalysis> {
  const srcW = cutout.width;
  const srcH = cutout.height;
  const s = Math.min(1, ANALYZE_DIM / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * s));
  const h = Math.max(1, Math.round(srcH * s));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(cutout, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const back = 1 / s; // canvas px → cutout px

  // ---- alpha map: bounds, per-row widths, coverage, luma -------------------
  const rowLeft = new Int32Array(h).fill(-1);
  const rowRight = new Int32Array(h).fill(-1);
  const rowCount = new Int32Array(h);
  let top = -1;
  let bottom = -1;
  let left = w;
  let right = -1;
  let opaque = 0;
  let lumaSum = 0;
  const gray = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      gray[y * w + x] = luma;
      if (data[i + 3] > ALPHA_ON) {
        opaque++;
        lumaSum += luma;
        rowCount[y]++;
        if (rowLeft[y] < 0) rowLeft[y] = x;
        rowRight[y] = x;
        if (top < 0) top = y;
        bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  const coverage = opaque / (w * h);
  const contentBounds =
    top >= 0
      ? { top: top * back, left: left * back, right: right * back, bottom: bottom * back }
      : null;
  const brightness = opaque > 0 ? lumaSum / opaque : null;

  // Head top: first row that is solidly opaque (≥3% of frame width) — a
  // couple of stray halo pixels don't count as hair.
  let headTopY: number | null = null;
  const solid = Math.max(2, Math.round(w * 0.03));
  for (let y = 0; y < h; y++) {
    if (rowCount[y] >= solid) {
      headTopY = y * back;
      break;
    }
  }

  // ---- face landmarks ------------------------------------------------------
  let faces = 0;
  let faceBox: FaceBox | null = null;
  let eyeY: number | null = null;
  let faceCenterX: number | null = null;
  try {
    const detector = await loadDetector();
    const result = detector.detect(canvas);
    const boxes = result.detections
      .filter((d) => d.boundingBox)
      .sort((a, b) => b.boundingBox!.height - a.boundingBox!.height);
    if (boxes.length > 0) {
      const primary = boxes[0].boundingBox!;
      faces = boxes.filter(
        (d) => d.boundingBox!.height >= primary.height * SIGNIFICANT_FACE,
      ).length;
      faceBox = {
        x: primary.originX * back,
        y: primary.originY * back,
        w: primary.width * back,
        h: primary.height * back,
      };
      // BlazeFace keypoints 0/1 = right/left eye (pixel coords on the canvas).
      const kp = boxes[0].keypoints;
      if (kp.length >= 2) {
        eyeY = ((kp[0].y + kp[1].y) / 2) * h * back;
        faceCenterX = ((kp[0].x + kp[1].x) / 2) * w * back;
      } else {
        eyeY = (primary.originY + primary.height * 0.38) * back;
        faceCenterX = (primary.originX + primary.width / 2) * back;
      }
    }
  } catch {
    // Detector failure → faces stays 0 → the validator rejects (Δ5); the
    // debug view attributes it to the LANDMARK stage.
  }

  // ---- shoulder line (alpha, below the chin) -------------------------------
  let shoulderY: number | null = null;
  let shoulderHalfW: number | null = null;
  if (faceBox && headTopY != null) {
    const chin = (faceBox.y + faceBox.h) / back; // canvas px
    const faceW = faceBox.w / back;
    const from = Math.min(h - 1, Math.round(chin + (faceBox.h / back) * 0.15));
    const to = Math.min(h - 1, Math.round(chin + (faceBox.h / back) * 2.2));
    let bestY = -1;
    let bestW = 0;
    for (let y = from; y <= to; y++) {
      if (rowCount[y] > bestW) {
        bestW = rowCount[y];
        bestY = y;
      }
      // First row clearly wider than the head = the shoulder line.
      if (rowLeft[y] >= 0 && rowRight[y] - rowLeft[y] >= faceW * 1.8) {
        bestY = y;
        bestW = rowRight[y] - rowLeft[y];
        break;
      }
    }
    if (bestY >= 0 && bestW > 0) {
      shoulderY = bestY * back;
      shoulderHalfW = (bestW / 2) * back;
    }
  }

  // ---- sharpness: Laplacian variance on the opaque region (soft signal) ----
  let sharpness: number | null = null;
  if (opaque > 100) {
    let sum = 0;
    let sumSq = 0;
    let n = 0;
    for (let y = 1; y < h - 1; y += 2) {
      for (let x = 1; x < w - 1; x += 2) {
        if (data[(y * w + x) * 4 + 3] <= ALPHA_ON) continue;
        const lap =
          -4 * gray[y * w + x] +
          gray[y * w + x - 1] +
          gray[y * w + x + 1] +
          gray[(y - 1) * w + x] +
          gray[(y + 1) * w + x];
        sum += lap;
        sumSq += lap * lap;
        n++;
      }
    }
    if (n > 0) sharpness = sumSq / n - (sum / n) ** 2;
  }

  return {
    srcW,
    srcH,
    faces,
    faceBox,
    eyeY,
    faceCenterX,
    headTopY,
    shoulderY,
    shoulderHalfW,
    contentBounds,
    coverage,
    brightness,
    sharpness,
  };
}
