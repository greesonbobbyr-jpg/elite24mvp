import { afterAll, beforeAll, describe, expect, it } from "vitest";

// STAGE 4a CONVERGE ROUND-TRIP, on the real local database:
//   legacy state → converge → (assertions) → rollback → (restored) →
//   converge×2 (idempotent) → rollback (suite leaves the DB in legacy state).
//
// Proves the no-window properties the runbook relies on:
//   1. NEW code is correct in BOTH database states: pre-flip its org read
//      falls back to the active globals (same list, same ids as legacy);
//      post-flip it serves the org clones with identical titles/points/order.
//   2. The flip is atomic with the log re-point: immediately after converge,
//      every today-log's questId is in the org's listed set (completion state
//      never wrong on any full render).
//   3. Rollback is one call and restores the legacy view exactly (actives +
//      today's logs; historical logs stay on clones by design).
//   4. LOCKED-IN ORDERING FACT: after the flip, a legacy-shape read (active,
//      NO org filter) returns EVERY org's clones — the doubled-list bug. This
//      is why the deploy must complete BEFORE the flip runs.
//
// Same runner contract: localhost-only, self-skips without TEST_DATABASE_URL.

const url = process.env.TEST_DATABASE_URL;
const host = url ? new URL(url).hostname : null;
if (url && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("TEST_DATABASE_URL must point at localhost — this suite writes.");
}
if (url) process.env.DATABASE_URL = url;

const dbDescribe = url ? describe : describe.skip;

const TODAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: process.env.APP_TIMEZONE ?? "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

dbDescribe("Stage 4a quest converge — round trip", () => {
  let todayLogId = 0;
  let orgId = 0;
  let globalQuestId = 0;

  beforeAll(async () => {
    const { prisma } = await import("../lib/prisma");
    const { rollbackQuests } = await import("../scripts/converge-quests");
    // Normalize: whatever state a previous run left, start from legacy.
    await rollbackQuests(prisma as never);

    // A real TODAY log on a GLOBAL quest (as prod would have pre-flip), from a
    // seeded player who has no quest logs today.
    const team = await prisma.team.findFirstOrThrow({ where: { organizationId: { not: null } } });
    orgId = team.organizationId!;
    const player = await prisma.user.findFirstOrThrow({
      where: { teamId: team.id, role: "PLAYER", questLogs: { none: { day: TODAY } } },
    });
    const globalQuest = await prisma.quest.findFirstOrThrow({ where: { organizationId: null } });
    globalQuestId = globalQuest.id;
    const log = await prisma.questLog.create({
      data: { userId: player.id, questId: globalQuest.id, day: TODAY },
    });
    todayLogId = log.id;
  });

  afterAll(async () => {
    const { prisma } = await import("../lib/prisma");
    const { rollbackQuests } = await import("../scripts/converge-quests");
    await rollbackQuests(prisma as never); // leave the DB in legacy state
    await prisma.questLog.deleteMany({ where: { id: todayLogId } });
    await prisma.$disconnect();
  });

  it("legacy state: globals active, clones dark, org read falls back to the SAME global list", async () => {
    const { prisma } = await import("../lib/prisma");
    const { listActiveQuestsForOrg } = await import("../lib/quests");

    expect(await prisma.quest.count({ where: { organizationId: null, active: true } })).toBe(6);
    expect(await prisma.quest.count({ where: { organizationId: { not: null }, active: true } })).toBe(0);

    const legacyList = await prisma.quest.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
    const newList = await listActiveQuestsForOrg(orgId);
    expect(newList.map((q) => q.id)).toEqual(legacyList.map((q) => q.id)); // no-window: same ids pre-flip
  });

  it("converge: atomic flip — org list identical by content, every today-log matches a listed id", async () => {
    const { prisma } = await import("../lib/prisma");
    const { convergeQuests } = await import("../scripts/converge-quests");
    const { listActiveQuestsForOrg } = await import("../lib/quests");

    const before = await prisma.quest.findMany({
      where: { organizationId: null }, orderBy: { sortOrder: "asc" },
    });
    await convergeQuests(prisma as never);

    expect(await prisma.quest.count({ where: { organizationId: null, active: true } })).toBe(0);
    // Every TEAM player's log moved to their org's copy. (An athlete with no
    // team logs the shared Elite24 set by design — those logs stay.)
    expect(
      await prisma.questLog.count({ where: { quest: { organizationId: null }, user: { teamId: { not: null } } } }),
    ).toBe(0);

    const after = await listActiveQuestsForOrg(orgId);
    expect(after.map((q) => [q.title, q.points, q.targetCount, q.sortOrder])).toEqual(
      before.map((q) => [q.title, q.points, q.targetCount, q.sortOrder]),
    ); // the player sees the same six tiles

    // Completion state: the today-log moved WITH the flip and matches the list.
    const log = await prisma.questLog.findUniqueOrThrow({ where: { id: todayLogId } });
    expect(after.map((q) => q.id)).toContain(log.questId);
  });

  it("ORDERING FACT: post-flip, a legacy-shape read shows EVERY org's clones (why deploy precedes flip)", async () => {
    const { prisma } = await import("../lib/prisma");
    const activeClones = await prisma.quest.count({
      where: { organizationId: { not: null }, active: true },
    });
    const legacyShape = await prisma.quest.count({ where: { active: true } });
    // The legacy-shape read returns ALL orgs' active clones — a doubled+ list
    // under old code, which is why the deploy must complete before the flip.
    expect(legacyShape).toBe(activeClones);
    expect(activeClones).toBeGreaterThanOrEqual(12); // ≥ 2 seeded orgs × 6
  });

  it("re-converge is a no-op (idempotent)", async () => {
    const { prisma } = await import("../lib/prisma");
    const { convergeQuests } = await import("../scripts/converge-quests");
    const r = await convergeQuests(prisma as never);
    expect(r).toEqual({ repointed: 0, activated: 0, retired: 0 });
  });

  it("rollback: one call restores the legacy view — actives back, today-log back on its global id", async () => {
    const { prisma } = await import("../lib/prisma");
    const { rollbackQuests } = await import("../scripts/converge-quests");
    const { listActiveQuestsForOrg } = await import("../lib/quests");

    await rollbackQuests(prisma as never);

    expect(await prisma.quest.count({ where: { organizationId: null, active: true } })).toBe(6);
    expect(await prisma.quest.count({ where: { organizationId: { not: null }, active: true } })).toBe(0);
    const log = await prisma.questLog.findUniqueOrThrow({ where: { id: todayLogId } });
    expect(log.questId).toBe(globalQuestId); // today's completion visible to legacy again

    // And the NEW code is correct in the rolled-back state too (fallback).
    const list = await listActiveQuestsForOrg(orgId);
    expect(list.every((q) => q.organizationId === null)).toBe(true);
    expect(list.map((q) => q.id)).toContain(globalQuestId);
  });
});
