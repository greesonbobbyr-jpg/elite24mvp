import { prisma } from "./prisma";

// Day keys are timezone-aware (lib/daykey) — re-exported here so the many
// existing `import { todayKey } from "@/lib/journal"` call sites keep working.
import { todayKey } from "./daykey";
export { todayKey };

// Today's check-in for a player, or null if they haven't checked in yet.
export function getTodaysEntry(userId: number) {
  return prisma.journalEntry.findUnique({
    where: { userId_day: { userId, day: todayKey() } },
  });
}

// All of a player's entries, newest first. Private to that player — callers
// always pass the current user's id (CLAUDE.md section 3.2).
export function listEntries(userId: number) {
  return prisma.journalEntry.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}
