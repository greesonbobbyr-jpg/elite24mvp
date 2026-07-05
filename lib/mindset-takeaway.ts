import { prisma } from "./prisma";
import { todayKey } from "./journal";

// Today's "1-Minute Mindset" takeaway for a player (text + time), or null. One
// per player per day (see @@unique). Reused by the check-in gate, the Home
// prefill, and the coach drill-in. Unlike the private check-in reflection, the
// takeaway is coach-visible by design, so reading it here is intentional.
export function getTodaysTakeaway(userId: number) {
  return prisma.mindsetTakeaway.findUnique({
    where: { userId_day: { userId, day: todayKey() } },
    select: { text: true, createdAt: true },
  });
}
