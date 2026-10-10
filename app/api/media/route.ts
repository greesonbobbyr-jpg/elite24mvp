import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentContext } from "@/lib/context";
import { mayAnnounce } from "@/lib/announcements";
import { cleanJpeg } from "@/lib/jpeg";
import { mediaStore } from "@/lib/mediaStore";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Upload ONE announcement picture (person-first plan Phase 5). Only people
// who can send announcements may upload. The phone has already shrunk it
// to a JPEG ≤1600px; the server re-checks it, strips anything that isn't
// the picture (location included), and stores it PRIVATELY. The picture
// belongs to no announcement until one is sent with it; unsent uploads are
// deleted by the hourly cleanup after a day.

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_EDGE = 2400;
const PER_HOUR = 60;

export async function POST(request: NextRequest) {
  const ctx = await getCurrentContext();
  if (!ctx?.profile || !mayAnnounce(ctx)) return new NextResponse("Not authorized", { status: 403 });
  const store = mediaStore();
  if (!store) return new NextResponse("Pictures are off", { status: 503 });

  if (request.headers.get("content-type") !== "image/jpeg") return new NextResponse("JPEG only", { status: 415 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) return new NextResponse("Too big", { status: 413 });
  const raw = Buffer.from(await request.arrayBuffer());
  if (raw.length === 0 || raw.length > MAX_UPLOAD_BYTES) return new NextResponse("Too big", { status: 413 });

  const recent = await prisma.mediaAsset.count({
    where: { uploadedByProfileId: ctx.profile.id, createdAt: { gt: new Date(Date.now() - 3600_000) } },
  });
  if (recent >= PER_HOUR) return new NextResponse("Too many uploads — try again later", { status: 429 });

  const clean = cleanJpeg(raw);
  if (!clean || clean.width > MAX_EDGE || clean.height > MAX_EDGE) {
    return new NextResponse("That picture couldn't be used", { status: 422 });
  }

  const id = randomUUID();
  const storageKey = `${new Date().toISOString().slice(0, 7)}/${id}.jpg`;
  await store.put(storageKey, clean.bytes, "image/jpeg");
  await prisma.mediaAsset.create({
    data: {
      id,
      storageKey,
      mime: "image/jpeg",
      bytes: clean.bytes.length,
      width: clean.width,
      height: clean.height,
      uploadedByProfileId: ctx.profile.id,
    },
  });
  return NextResponse.json({ id, width: clean.width, height: clean.height });
}
