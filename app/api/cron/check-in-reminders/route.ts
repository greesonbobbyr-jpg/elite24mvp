import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { dayKeyInTz } from "@/lib/daykey";
import { pushToUser } from "@/lib/push";

export const runtime = "nodejs";

// Hourly cron (GitHub Actions — Vercel Hobby crons are daily-only): for each
// team whose coach-set reminder hour matches the current hour in the TEAM's
// timezone, push a check-in reminder to subscribed players who haven't checked
// in today. Guarded by CRON_SECRET; payload contains no PII. The unique
// (team-hour) match means each team is pinged at most once per day.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Not authorized", { status: 401 });
  }

  const now = new Date();
  const teams = await prisma.team.findMany({
    where: { checkInReminderHour: { not: null } },
    select: { id: true, timezone: true, checkInReminderHour: true },
  });

  let teamsMatched = 0;
  let playersPinged = 0;

  for (const team of teams) {
    // Current hour in the team's timezone.
    const hour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: team.timezone,
        hour12: false,
        hour: "2-digit",
      }).format(now),
    );
    if (hour % 24 !== (team.checkInReminderHour as number) % 24) continue;
    teamsMatched++;

    const today = dayKeyInTz(now, team.timezone);
    const players = await prisma.user.findMany({
      where: {
        teamId: team.id,
        role: "PLAYER",
        pushSubscriptions: { some: {} },
        journalEntries: { none: { day: today } },
      },
      select: { id: true },
    });

    for (const p of players) {
      const sent = await pushToUser(p.id, {
        title: "Elite24MVP",
        body: "Time to check in 🏀 Your streak is waiting.",
        url: "/",
      });
      if (sent > 0) playersPinged++;
    }
  }

  return NextResponse.json({ ok: true, teamsMatched, playersPinged });
}
