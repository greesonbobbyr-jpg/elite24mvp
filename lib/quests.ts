import { prisma } from "./prisma";
import { todayKey } from "./journal";

// Active quest definitions, in display order. Quests are global/shared for the
// MVP (not team-specific).
export function listActiveQuests() {
  return prisma.quest.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
}

// The ids of quests this player has COMPLETED today (status APPROVED — a
// measurable quest that's only been predicted/started is PENDING, not done).
export async function getTodaysCompletedQuestIds(
  userId: number,
): Promise<number[]> {
  const logs = await prisma.questLog.findMany({
    where: { userId, day: todayKey(), status: "APPROVED" },
    select: { questId: true },
  });
  return logs.map((log) => log.questId);
}

// ALL of today's logs for a player (both PENDING predictions and APPROVED
// completions) keyed by quest — drives the predict-then-log quest UI.
export async function getTodaysQuestLogs(userId: number) {
  const logs = await prisma.questLog.findMany({
    where: { userId, day: todayKey() },
    select: { questId: true, status: true, predicted: true, actual: true },
  });
  return new Map(logs.map((l) => [l.questId, l]));
}
