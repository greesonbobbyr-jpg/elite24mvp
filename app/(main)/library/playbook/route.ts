import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { isOnboarded } from "@/lib/onboarding";

export const runtime = "nodejs";

// Read the PDF once and keep it in memory; the browser's inline PDF viewer
// issues many range requests, so we don't want to re-read 5 MB each time.
let cachedFile: Buffer | null = null;
async function loadPlaybook(): Promise<Buffer | null> {
  if (cachedFile) return cachedFile;
  try {
    cachedFile = await fs.readFile(
      path.join(process.cwd(), "content", "e24playbook.pdf"),
    );
    return cachedFile;
  } catch {
    return null;
  }
}

// Serves the team playbook PDF, gated to team members (a coach, or an onboarded
// player) — the same access as the rest of the app. The file lives in content/
// (NOT public/), so it is never reachable on an un-gated URL (CLAUDE.md §3.2).
// Route handlers bypass the (main) layout, so the gate is enforced here.
// Supports HTTP Range requests so the browser's inline PDF viewer renders.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const allowed = !!user && (user.role === "COACH" || isOnboarded(user));
  if (!allowed) {
    return new NextResponse("Not authorized", { status: 403 });
  }

  const file = await loadPlaybook();
  if (!file) {
    return new NextResponse("Playbook not found", { status: 404 });
  }

  const total = file.length;
  const download = request.nextUrl.searchParams.get("download") !== null;
  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="e24playbook.pdf"`,
    "Accept-Ranges": "bytes",
    // Private document — never cached by shared/proxy caches.
    "Cache-Control": "private, max-age=0, must-revalidate",
  };

  const rangeHeader = request.headers.get("range");
  const match = rangeHeader
    ? /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
    : null;

  if (match) {
    let start = match[1] === "" ? 0 : Number.parseInt(match[1], 10);
    let end = match[2] === "" ? total - 1 : Number.parseInt(match[2], 10);
    if (Number.isNaN(start)) start = 0;
    if (Number.isNaN(end) || end >= total) end = total - 1;

    if (start > end || start >= total) {
      return new NextResponse("Range Not Satisfiable", {
        status: 416,
        headers: { "Accept-Ranges": "bytes", "Content-Range": `bytes */${total}` },
      });
    }

    const chunk = file.subarray(start, end + 1);
    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${total}`,
        "Content-Length": String(chunk.length),
      },
    });
  }

  return new NextResponse(new Uint8Array(file), {
    status: 200,
    headers: { ...headers, "Content-Length": String(total) },
  });
}
