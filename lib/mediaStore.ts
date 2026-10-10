import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

// PRIVATE STORAGE for announcement pictures (person-first plan Phase 5).
// Nothing here is ever public: pictures are served only through
// /api/media/[id], which checks who's asking first, then hands back a
// 5-minute link (Supabase) or the bytes (local).
//
//   supabase  SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY: a PRIVATE bucket
//             (SUPABASE_MEDIA_BUCKET, default "announcement-media")
//   local     development without those keys: files under .media/
//   memory    tests (setMediaStoreForTests)
// In production without the keys there is no store: pictures are off and
// announcements are text + links only.

export type MediaRead = { url: string } | { bytes: Buffer } | null;

export type MediaStore = {
  put(key: string, bytes: Buffer, mime: string): Promise<void>;
  remove(keys: string[]): Promise<void>;
  read(key: string): Promise<MediaRead>;
};

const SIGNED_SECONDS = 300;

function supabaseStore(url: string, key: string, bucket: string): MediaStore {
  const base = url.replace(/\/$/, "");
  const auth = { Authorization: `Bearer ${key}` };
  const path = (k: string) => k.split("/").map(encodeURIComponent).join("/");
  return {
    async put(k, bytes, mime) {
      const res = await fetch(`${base}/storage/v1/object/${bucket}/${path(k)}`, {
        method: "POST",
        headers: { ...auth, "Content-Type": mime, "x-upsert": "false" },
        body: new Uint8Array(bytes),
      });
      if (!res.ok) throw new Error(`Storage upload failed (${res.status})`);
    },
    async remove(keys) {
      if (keys.length === 0) return;
      const res = await fetch(`${base}/storage/v1/object/${bucket}`, {
        method: "DELETE",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: keys }),
      });
      if (!res.ok) throw new Error(`Storage delete failed (${res.status})`);
    },
    async read(k) {
      const res = await fetch(`${base}/storage/v1/object/sign/${bucket}/${path(k)}`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: SIGNED_SECONDS }),
      });
      if (!res.ok) return null;
      const { signedURL } = (await res.json()) as { signedURL?: string };
      return signedURL ? { url: `${base}/storage/v1${signedURL}` } : null;
    },
  };
}

/** The development store (.media/) — the seed writes here directly, never
 * to Supabase, whatever the environment says. */
export const localMediaStore = () => localStore(join(process.cwd(), ".media"));

function localStore(root: string): MediaStore {
  const file = (k: string) => {
    if (k.includes("..")) throw new Error("bad key");
    return join(root, k);
  };
  return {
    async put(k, bytes) {
      await mkdir(dirname(file(k)), { recursive: true });
      await writeFile(file(k), bytes);
    },
    async remove(keys) {
      await Promise.all(keys.map((k) => rm(file(k), { force: true })));
    },
    async read(k) {
      try {
        return { bytes: await readFile(file(k)) };
      } catch {
        return null;
      }
    },
  };
}

export function memoryStore(): MediaStore & { keys(): string[] } {
  const files = new Map<string, Buffer>();
  return {
    async put(k, bytes) {
      files.set(k, bytes);
    },
    async remove(keys) {
      for (const k of keys) files.delete(k);
    },
    async read(k) {
      const bytes = files.get(k);
      return bytes ? { bytes } : null;
    },
    keys: () => [...files.keys()],
  };
}

let override: MediaStore | null | undefined;
export function setMediaStoreForTests(store: MediaStore | null | undefined) {
  override = store;
}

export function mediaStore(): MediaStore | null {
  if (override !== undefined) return override;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return supabaseStore(url, key, process.env.SUPABASE_MEDIA_BUCKET || "announcement-media");
  if (process.env.NODE_ENV !== "production") return localMediaStore();
  return null;
}

/** Can announcements carry pictures right now? */
export const mediaEnabled = () => mediaStore() != null;
