import { prisma } from "./prisma";
import { todayKey } from "./daykey";

// The evening "Pro Review" — data access. PRIVACY: review text is player-private
// (like the journal); callers always pass the CURRENT user's id. The one
// coach-facing read is reviewDoneToday (status only, no text) in lib/coach.

// Today's review for a player, or null.
export function getTodaysReview(userId: number) {
  return prisma.dailyReview.findUnique({
    where: { userId_day: { userId, day: todayKey() } },
  });
}

// The most recent past review that carries a "note to tomorrow-you" — surfaced
// above the next morning's check-in prompt (the investment loads the trigger).
export function getLatestReviewNote(userId: number) {
  return prisma.dailyReview.findFirst({
    where: {
      userId,
      day: { lt: todayKey() },
      noteToTomorrow: { not: null },
      NOT: { noteToTomorrow: "" },
    },
    orderBy: { day: "desc" },
    select: { day: true, noteToTomorrow: true },
  });
}
