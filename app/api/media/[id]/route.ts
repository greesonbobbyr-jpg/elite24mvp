import { NextResponse, type NextRequest } from "next/server";
import { getCurrentContext } from "@/lib/context";
import { canSeeAnnouncement } from "@/lib/announcements";
import { mediaStore } from "@/lib/mediaStore";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Serve an announcement picture — only to someone the announcement is for
// (or who sent / manages it), and only while it's live. Everyone else gets
// a 404, the same as a picture that doesn't exist. Supabase: a redirect to
// a 5-minute signed link; local development: the bytes.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCurrentContext();
  if (!ctx?.profile) return new NextResponse("Not authorized", { status: 403 });
  const { id } = await params;
  const notFound = new NextResponse("Not found", { status: 404 });
  if (!/^[0-9a-f-]{36}$/.test(id)) return notFound;

  const asset = await prisma.mediaAsset.findUnique({ where: { id }, include: { announcement: true } });
  if (!asset || asset.deletedAt) return notFound;
  const allowed = asset.announcement
    ? await canSeeAnnouncement(ctx, asset.announcement)
    : asset.uploadedByProfileId === ctx.profile.id; // a picture still being composed
  if (!allowed) return notFound;

  const read = await mediaStore()?.read(asset.storageKey);
  if (!read) return notFound;
  if ("url" in read) {
    return NextResponse.redirect(read.url, { status: 302, headers: { "Cache-Control": "private, max-age=240" } });
  }
  return new NextResponse(new Uint8Array(read.bytes), {
    headers: {
      "Content-Type": asset.mime,
      "Content-Length": String(read.bytes.length),
      "Cache-Control": "private, max-age=300",
    },
  });
}
