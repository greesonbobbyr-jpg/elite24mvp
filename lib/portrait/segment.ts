// Client-side background removal (photo pipeline A). Runs ENTIRELY on-device
// via self-hosted WASM + model assets under /bg-removal/ (copied from the npm
// data package on postinstall) — a user's photo never leaves the browser
// during processing, and no third-party host is ever contacted. Browser-only;
// the library is dynamically imported so it never enters a server bundle.

/** Segmentation progress: 0..1 across download + inference. */
export type SegmentProgress = (fraction: number) => void;

/**
 * Removes the background from a photo. Input is a data: URL or Blob; output is
 * a PNG blob with a real alpha channel. Throws on failure — callers translate
 * that into the card-creation rejection (Δ5), never a silent fallback.
 */
export async function segmentPhoto(
  source: Blob | string,
  onProgress?: SegmentProgress,
): Promise<Blob> {
  const { removeBackground } = await import("@imgly/background-removal");
  return removeBackground(source, {
    publicPath: `${window.location.origin}/bg-removal/`,
    // v1.4.x runs on cpu/wasm only (gpu arrived later) — deterministic and
    // universally available; the self-hosted asset set matches it.
    // "medium" = isnet_fp16 — the hair-edge quality the card needs; "small"
    // visibly degrades exactly where the §25 failure list looks.
    model: "medium",
    output: { format: "image/png", quality: 1 },
    progress: onProgress
      ? (_key: string, current: number, total: number) => {
          if (total > 0) onProgress(Math.min(1, current / total));
        }
      : undefined,
  });
}
