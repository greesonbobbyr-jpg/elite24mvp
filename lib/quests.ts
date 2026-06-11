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

// The ids of quests this player has already completed today (DB-enforced one
// per player per quest per day). Used to show them as done in the UI.
export async function getTodaysCompletedQuestIds(
  userId: number,
): Promise<number[]> {
  const logs = await prisma.questLog.findMany({
    where: { userId, day: todayKey() },
    select: { questId: true },
  });
  return logs.map((log) => log.questId);
}
