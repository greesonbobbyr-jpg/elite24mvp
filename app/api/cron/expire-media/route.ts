import { NextResponse, type NextRequest } from "next/server";
import { expireMedia } from "@/lib/announcements";

export const runtime = "nodejs";

// Hourly (GitHub Actions, alongside the check-in reminders): deletes the
// pictures of announcements that disappeared or were deleted, and pictures
// uploaded but never sent. Guarded by CRON_SECRET.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Not authorized", { status: 401 });
  }
  return NextResponse.json({ ok: true, ...(await expireMedia()) });
}
