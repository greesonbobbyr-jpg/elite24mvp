import { readFile } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { NextResponse } from "next/server";

// DEV-ONLY static server for the approved reference images in
// design/reference/ (they live outside public/ on purpose — they are design
// inputs, not app assets). Used exclusively by the /card-preview overlay
// mode; hard-disabled in production builds.

// Two drop zones: the owner's finalized package (design-reference/…) and the
// older loose folder (design/reference/). Both are design inputs, not app assets.
const REFERENCE_DIRS = [
  join(process.cwd(), "design-reference", "elite24mvp-player-card"),
  join(process.cwd(), "design", "reference"),
];

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }
  const { name } = await params;
  // basename() strips any traversal; only known image extensions are served.
  const safe = basename(name);
  const mime = MIME[extname(safe).toLowerCase()];
  if (!mime) return new NextResponse("Not found", { status: 404 });
  for (const dir of REFERENCE_DIRS) {
    try {
      const bytes = await readFile(join(dir, safe));
      return new NextResponse(new Uint8Array(bytes), {
        headers: { "Content-Type": mime, "Cache-Control": "no-store" },
      });
    } catch {
      /* try the next folder */
    }
  }
  return new NextResponse("Not found", { status: 404 });
}
