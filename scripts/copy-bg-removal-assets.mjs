// Copies the background-removal model assets from the npm data package into
// public/bg-removal/ so segmentation is fully SELF-HOSTED — user photos are
// processed on-device and no third-party CDN is ever contacted (a real privacy
// requirement for a minors' app). Runs on postinstall; public/bg-removal/ is
// git-ignored (the data package is the source of truth).
//
// PRUNED to what the pipeline actually uses (~114MB of the 212MB package):
//   /models/medium              isnet_fp16 — the quality/size sweet spot
//   /onnxruntime-web/ort-wasm[-simd][-threaded].wasm   cpu runtimes
// (gpu/jsep + training wasm + /models/small are deliberately excluded; the
// upload pipeline pins device:"cpu", model:"medium".)
import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "node_modules", "@imgly", "background-removal-data", "dist");
const outDir = join(root, "public", "bg-removal");

const KEEP = [
  "/models/medium",
  "/onnxruntime-web/ort-wasm.wasm",
  "/onnxruntime-web/ort-wasm-simd.wasm",
  "/onnxruntime-web/ort-wasm-simd-threaded.wasm",
];

if (!existsSync(join(srcDir, "resources.json"))) {
  console.warn(
    "copy-bg-removal-assets: @imgly/background-removal-data not installed — skipping.",
  );
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(join(srcDir, "resources.json"), "utf8"));
const pruned = {};
let copied = 0;
let bytes = 0;
mkdirSync(outDir, { recursive: true });

for (const key of KEEP) {
  const entry = manifest[key];
  if (!entry) {
    console.warn(`copy-bg-removal-assets: manifest missing ${key} — skipping it.`);
    continue;
  }
  pruned[key] = entry;
  for (const chunk of entry.chunks) {
    // v1.4.x chunk files are named by their content hash.
    const name = chunk.name ?? chunk.hash;
    const dest = join(outDir, name);
    const size = chunk.offsets[1] - chunk.offsets[0];
    bytes += size;
    if (existsSync(dest) && statSync(dest).size === size) continue; // idempotent
    copyFileSync(join(srcDir, name), dest);
    copied++;
  }
}

writeFileSync(join(outDir, "resources.json"), JSON.stringify(pruned));
console.log(
  `copy-bg-removal-assets: ${Object.keys(pruned).length} resources, ` +
    `${(bytes / 1048576).toFixed(0)}MB total, ${copied} chunk(s) copied.`,
);

// ---- MediaPipe FaceDetector wasm (portrait normalization, Stage 4) ---------
// Same self-hosting rule: the vision wasm runtime serves from /face/wasm/
// (git-ignored); the tiny blaze_face_short_range.tflite model IS committed at
// public/face/. Photos never leave the device.
const mpSrc = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const mpOut = join(root, "public", "face", "wasm");
if (existsSync(mpSrc)) {
  mkdirSync(mpOut, { recursive: true });
  let mpCopied = 0;
  for (const name of readdirSync(mpSrc)) {
    const dest = join(mpOut, name);
    const src = join(mpSrc, name);
    if (existsSync(dest) && statSync(dest).size === statSync(src).size) continue;
    copyFileSync(src, dest);
    mpCopied++;
  }
  console.log(`copy-vision-assets: mediapipe wasm staged (${mpCopied} file(s) copied).`);
} else {
  console.warn("copy-vision-assets: @mediapipe/tasks-vision not installed — skipping.");
}
