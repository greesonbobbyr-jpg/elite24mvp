import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

// Serves a user's profile photo as real image bytes instead of inlining the
// stored data: URL into every list page's HTML (which made the leaderboard >1MB
// for one roster). Auth-gated + TEAM-SCOPED: only someone on the same team can
// load a photo (CLAUDE.md §3.2). Player photos live on PlayerProfile.photoUrl,
// coach photos on User.photoUrl. Non-data values (http(s)/path) redirect.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const viewer = await getCurrentUser();
  if (!viewer) return new NextResponse("Not authorized", { status: 403 });

  const { userId } = await params;
  const id = Number.parseInt(userId, 10);
  if (!Number.isInteger(id)) return new NextResponse("Bad id", { status: 400 });

  const target = await prisma.user.findUnique({
    where: { id },
    select: {
      teamId: true,
      role: true,
      photoUrl: true,
      profile: { select: { photoUrl: true } },
    },
  });
  if (!target || target.teamId !== viewer.teamId) {
    return new NextResponse("Not found", { status: 404 });
  }

  const stored =
    target.role === "PLAYER"
      ? (target.profile?.photoUrl ?? null)
      : target.photoUrl;
  if (!stored) return new NextResponse("No photo", { status: 404 });

  // Pass-through for non-data values (pasted URL / public path).
  if (!stored.startsWith("data:")) {
    return NextResponse.redirect(new URL(stored, request.nextUrl.origin));
  }

  const match = /^data:(image\/[a-z+.-]+);base64,(.*)$/i.exec(stored);
  if (!match) return new NextResponse("Unsupported", { status: 415 });

  const bytes = Buffer.from(match[2], "base64");
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": match[1],
      "Content-Length": String(bytes.length),
      // Private (team-scoped) but cacheable; the ?v= content hash busts changes.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
