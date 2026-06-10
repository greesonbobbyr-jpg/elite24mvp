import { prisma } from "./prisma";

// The local calendar day as "YYYY-MM-DD". Used to enforce one check-in per day
// and to date journal entries. Server-local time is fine for this local MVP.
export function todayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

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
