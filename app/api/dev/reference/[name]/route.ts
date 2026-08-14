import { readFile } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { NextResponse } from "next/server";

// DEV-ONLY static server for the approved reference images in
// design/reference/ (they live outside public/ on purpose — they are design
// inputs, not app assets). Used exclusively by the /card-preview overlay
// mode; hard-disabled in production builds.

const REFERENCE_DIR = join(process.cwd(), "design", "reference");

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
  try {
    const bytes = await readFile(join(REFERENCE_DIR, safe));
    return new NextResponse(new Uint8Array(bytes), {
      headers: { "Content-Type": mime, "Cache-Control": "no-store" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
