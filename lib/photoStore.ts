// Optional Supabase Storage backend for uploaded images (player/coach photos,
// team logos). OFF unless PHOTO_STORAGE=supabase-public is set as well as
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Off, every call passes the
// validated data: URL through unchanged (current, working behavior — images
// live in the DB row and serve via /api/photo, behind the app's access rules).
//
// Its own switch on purpose (2026-10-10): the Supabase keys now also power the
// PRIVATE announcement media store (lib/mediaStore), and adding them must never
// silently move kids' photos into this PUBLIC "photos" bucket. Turning it on is
// a separate, deliberate privacy decision.

const BUCKET = "photos";

function config() {
  if (process.env.PHOTO_STORAGE !== "supabase-public") return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

// Store a validated data: image. Returns the value to persist: a public https
// URL when Storage is configured + upload succeeds, else the original data URL.
export async function storeImage(
  dataUrl: string,
  path: string, // e.g. "players/42" — extension appended from the mime type
): Promise<string> {
  const cfg = config();
  if (!cfg || !dataUrl.startsWith("data:")) return dataUrl;

  const match = /^data:(image\/[a-z+.-]+);base64,(.*)$/i.exec(dataUrl);
  if (!match) return dataUrl;
  const [, mime, b64] = match;
  const ext = (mime.split("/")[1] ?? "bin").replace("jpeg", "jpg");
  // Content-hash suffix so replacing a photo gets a fresh, cache-safe URL.
  const hash = Math.abs(
    [...b64.slice(0, 4096)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7),
  ).toString(36);
  const objectPath = `${path}-${hash}.${ext}`;

  try {
    const res = await fetch(
      `${cfg.url}/storage/v1/object/${BUCKET}/${objectPath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.key}`,
          "Content-Type": mime,
          "x-upsert": "true",
        },
        body: Buffer.from(b64, "base64"),
      },
    );
    if (!res.ok) return dataUrl; // fail-safe: keep the working in-DB value
    return `${cfg.url}/storage/v1/object/public/${BUCKET}/${objectPath}`;
  } catch {
    return dataUrl;
  }
}
