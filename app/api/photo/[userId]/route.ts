import { NextResponse, type NextRequest } from "next/server";
import { getCurrentContext } from "@/lib/context";
import { resolveBrandAccess } from "@/lib/brand-access";

export const runtime = "nodejs";

// Serves a user's profile photo as real image bytes instead of inlining the
// stored data: URL into every list page's HTML (which made the leaderboard >1MB
// for one roster). Auth-gated + ORG-BOUNDED (Stage 4b): access mirrors the
// Brand page — self, org staff (view_player_detail), or a teammate on the
// target's team (view_roster). Another org's members always get 404. Player
// photos live on PlayerProfile.photoUrl, coach photos on User.photoUrl.
// Non-data values (http(s)/path) redirect.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const ctx = await getCurrentContext();
  if (!ctx) return new NextResponse("Not authorized", { status: 403 });

  const { userId } = await params;
  const id = Number.parseInt(userId, 10);
  if (!Number.isInteger(id)) return new NextResponse("Bad id", { status: 400 });

  const resolved = await resolveBrandAccess(ctx, id);
  if (!resolved || resolved.access === null) {
    return new NextResponse("Not found", { status: 404 });
  }
  const { target } = resolved;

  // ?cut=1 serves the card-portrait CUTOUT (photo pipeline A) instead of the
  // original — same auth/org-bounding, different stored column.
  const wantCutout = request.nextUrl.searchParams.get("cut") === "1";
  const stored =
    target.role === "PLAYER"
      ? ((wantCutout ? target.profile?.photoCutoutUrl : target.profile?.photoUrl) ?? null)
      : wantCutout
        ? target.photoCutoutUrl
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
      // Private (org-scoped) but cacheable; the ?v= content hash busts changes.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
