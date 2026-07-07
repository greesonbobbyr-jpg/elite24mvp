// Shared client-side image resize for in-browser uploads (team logo + player
// photo). Resizes a chosen file to a small `data:` URL — no upload endpoint or
// file hosting; the server re-validates it. Browser-only (FileReader/Image/canvas).

export const MAX_DIM = 512; // longest edge, px
export const MAX_BYTES = 200 * 1024; // ~200 KB cap on the stored data URL

export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  // base64 → bytes (ignore padding precisely enough for a cap check)
  return Math.floor((b64.length * 3) / 4);
}

export async function readImage(file: File): Promise<HTMLImageElement> {
  const url = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("read failed"));
    fr.readAsDataURL(file);
  });
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("decode failed"));
    img.src = url;
  });
}

export function encode(
  img: HTMLImageElement,
  max: number,
  quality: number,
): string {
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(img, 0, 0, w, h);
  // webp where supported; browsers that don't support it fall back to png.
  return canvas.toDataURL("image/webp", quality);
}

// Validate + resize a chosen file to a capped `data:` URL. Returns `{ url }` or
// `{ error }` (a user-facing message). First-pass then a smaller/lower-quality
// retry if over the byte cap — the same logic the team-logo dropzone used.
export async function resizeToDataUrl(
  file: File | undefined | null,
): Promise<{ url: string } | { error: string }> {
  if (!file) return { error: "No file." };
  if (!file.type.startsWith("image/")) {
    return { error: "Please choose an image file." };
  }
  try {
    const img = await readImage(file);
    let out = encode(img, MAX_DIM, 0.85);
    if (out && dataUrlBytes(out) > MAX_BYTES) out = encode(img, 320, 0.7);
    if (!out) return { error: "Couldn't process that image. Try another." };
    if (dataUrlBytes(out) > MAX_BYTES) {
      return { error: "That image is too large. Try a smaller one." };
    }
    return { url: out };
  } catch {
    return { error: "Couldn't read that image. Try another." };
  }
}
