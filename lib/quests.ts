import { prisma } from "./prisma";
import { todayKey } from "./journal";

// Active quest definitions, in display order — ORG-SCOPED since Stage 4a
// (each org owns its quest set; the Stage 1 backfill cloned the global six
// per org, and the converge step activates the clones and retires the
// globals).
//
// FALLBACK (dies at Stage 6): if the org has no active quests yet, the shared
// database hasn't run the converge flip — serve the legacy global set. This
// makes the new code correct in BOTH database states, so the converge flip
// and the deploy don't need to be simultaneous; there is no wrong-list window
// in either order. Also covers a signed-in user with no org (legacy-only
// login) the same way the old code did.
export async function listActiveQuestsForOrg(
  organizationId: number | null | undefined,
) {
  if (organizationId != null) {
    const orgQuests = await prisma.quest.findMany({
      where: { organizationId, active: true },
      orderBy: { sortOrder: "asc" },
    });
    if (orgQuests.length > 0) return orgQuests;
  }
  return prisma.quest.findMany({
    where: { organizationId: null, active: true },
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
