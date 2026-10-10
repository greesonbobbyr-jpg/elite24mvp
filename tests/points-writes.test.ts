import { afterAll, beforeAll, describe, expect, it } from "vitest";

// THE POINTS WRITE PATHS, END TO END: drives the REAL production write paths
// (lib/data/points) through a check-in, a one-tap quest, an undo, a measured
// quest, a Pro Review, and coach adjustments — then proves the cache
// discipline and the sum invariants:
//   Profile.careerPoints  == Σ ledger by profileId    (the person)
//   Membership.points     == Σ ledger by membershipId (the team board)
// and that the ledger by login (userId) sums to the same career total.
// Also covers the no-team ruling (no active membership: check-in stamps
// profileId + NULL membershipId, quests included) and reversal-by-stamp.
//
// Same runner contract as the other DB suites: localhost-only, self-skips
// without TEST_DATABASE_URL. Builds its own throwaway world; cleans up after.

const url = process.env.TEST_DATABASE_URL;
const host = url ? new URL(url).hostname : null;
if (url && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("TEST_DATABASE_URL must point at localhost — this suite writes.");
}
if (url) process.env.DATABASE_URL = url;

const dbDescribe = url ? describe : describe.skip;

const DAY = "2031-01-15"; // fixed synthetic day — never collides with seed data

dbDescribe("points write paths — end-to-end + invariants", () => {
  // Built in beforeAll, torn down in afterAll.
  const world = {} as {
    orgId: number;
    seasonId: number;
    teamId: number;
    userId: number;
    profileId: number;
    membershipId: number;
    offUserId: number;
    offProfileId: number;
    questTapId: number;
    questMeasuredId: number;
  };

  beforeAll(async () => {
    const { prisma } = await import("../lib/prisma");
    const org = await prisma.organization.create({ data: { name: "__dw_org__" } });
    const season = await prisma.season.create({
      data: { organizationId: org.id, name: "__dw__", isCurrent: true },
    });
    const team = await prisma.team.create({
      data: { name: "__dw_team__", organizationId: org.id },
    });
    const user = await prisma.user.create({ data: { name: "__dw_player__" } });
    const profile = await prisma.profile.create({
      data: { userId: user.id, name: user.name, dream: "test", setupCompletedAt: new Date() },
    });
    const membership = await prisma.membership.create({
      data: { profileId: profile.id, teamId: team.id, seasonId: season.id, role: "PLAYER" },
    });
    // Offseason player: has a Profile but NO active membership.
    const offUser = await prisma.user.create({ data: { name: "__dw_offseason__" } });
    const offProfile = await prisma.profile.create({
      data: { userId: offUser.id, name: offUser.name, dream: "test", setupCompletedAt: new Date() },
    });
    // Inactive synthetic quests: never listed for anyone, even mid-test.
    const questTap = await prisma.quest.create({
      data: { title: "__dw_tap__", description: "t", points: 20, active: false },
    });
    const questMeasured = await prisma.quest.create({
      data: { title: "__dw_measured__", description: "t", points: 30, targetCount: 50, active: false },
    });
    Object.assign(world, {
      orgId: org.id, seasonId: season.id, teamId: team.id,
      userId: user.id, profileId: profile.id, membershipId: membership.id,
      offUserId: offUser.id, offProfileId: offProfile.id,
      questTapId: questTap.id, questMeasuredId: questMeasured.id,
    });
  });

  afterAll(async () => {
    const { prisma } = await import("../lib/prisma");
    // Users first (cascades their rows incl. the ledger), then the rest.
    await prisma.user.deleteMany({ where: { id: { in: [world.userId, world.offUserId] } } });
    await prisma.membership.deleteMany({ where: { teamId: world.teamId } });
    await prisma.profile.deleteMany({ where: { id: { in: [world.profileId, world.offProfileId] } } });
    await prisma.season.deleteMany({ where: { organizationId: world.orgId } });
    await prisma.team.deleteMany({ where: { id: world.teamId } });
    await prisma.organization.deleteMany({ where: { id: world.orgId } });
    await prisma.quest.deleteMany({ where: { id: { in: [world.questTapId, world.questMeasuredId] } } });
    await prisma.$disconnect();
  });

  async function caches() {
    const { prisma } = await import("../lib/prisma");
    const [byLogin, profile, membership] = await Promise.all([
      prisma.pointsLedger.aggregate({ where: { userId: world.userId }, _sum: { amount: true } }),
      prisma.profile.findUniqueOrThrow({ where: { id: world.profileId } }),
      prisma.membership.findUniqueOrThrow({ where: { id: world.membershipId } }),
    ]);
    // ledger: Σ ledger rows by login — what the caches must equal.
    return { ledger: byLogin._sum.amount ?? 0, career: profile.careerPoints, team: membership.points, profile };
  }

  async function assertInvariants() {
    const { prisma } = await import("../lib/prisma");
    // Scoped to the test world, plus the whole-DB sweep for collateral damage.
    const byProfile = await prisma.pointsLedger.aggregate({
      where: { profileId: world.profileId }, _sum: { amount: true },
    });
    const byMembership = await prisma.pointsLedger.aggregate({
      where: { membershipId: world.membershipId }, _sum: { amount: true },
    });
    const c = await caches();
    expect(c.career).toBe(byProfile._sum.amount ?? 0);
    expect(c.team).toBe(byMembership._sum.amount ?? 0);

    const profiles = await prisma.profile.findMany({ select: { id: true, careerPoints: true } });
    const sums = await prisma.pointsLedger.groupBy({ by: ["profileId"], _sum: { amount: true } });
    const sumOf = new Map(sums.map((r) => [r.profileId, r._sum.amount ?? 0]));
    for (const p of profiles) expect(p.careerPoints, `profile ${p.id}`).toBe(sumOf.get(p.id) ?? 0);
  }

  const ctx = () => ({
    user: { id: world.userId },
    profile: { id: world.profileId },
    membership: { id: world.membershipId },
  });

  it("check-in: stamps ledger + entry, bumps both caches, advances the person's streak", async () => {
    const { prisma } = await import("../lib/prisma");
    const { performCheckIn } = await import("../lib/data/points");
    await performCheckIn(ctx(), "work on handles", DAY, 5);

    const entry = await prisma.journalEntry.findUniqueOrThrow({
      where: { userId_day: { userId: world.userId, day: DAY } },
    });
    expect(entry.profileId).toBe(world.profileId);
    const ledger = await prisma.pointsLedger.findFirstOrThrow({
      where: { userId: world.userId, source: "DAILY_CHECK_IN" },
    });
    expect(ledger.profileId).toBe(world.profileId);
    expect(ledger.membershipId).toBe(world.membershipId);

    const c = await caches();
    expect([c.ledger, c.career, c.team]).toEqual([5, 5, 5]);
    expect(c.profile.currentStreak).toBe(1); // the streak follows the person
    expect(c.profile.lastCheckInDay).toBe(DAY);
    await assertInvariants();
  });

  it("double check-in throws P2002 and changes nothing (idempotent day)", async () => {
    const { Prisma } = await import("@prisma/client");
    const { performCheckIn } = await import("../lib/data/points");
    await expect(performCheckIn(ctx(), "again", DAY, 5)).rejects.toSatisfy(
      (e) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002",
    );
    const c = await caches();
    expect([c.ledger, c.career, c.team]).toEqual([5, 5, 5]);
    await assertInvariants();
  });

  it("one-tap quest completion stamps log + ledger and bumps the trio", async () => {
    const { prisma } = await import("../lib/prisma");
    const { performOneTapQuest } = await import("../lib/data/points");
    const quest = await prisma.quest.findUniqueOrThrow({ where: { id: world.questTapId } });
    await performOneTapQuest(ctx(), quest, DAY);

    const log = await prisma.questLog.findUniqueOrThrow({
      where: { userId_questId_day: { userId: world.userId, questId: quest.id, day: DAY } },
      include: { pointsLedger: true },
    });
    expect(log.profileId).toBe(world.profileId);
    expect(log.membershipId).toBe(world.membershipId);
    expect(log.pointsLedger?.membershipId).toBe(world.membershipId);

    const c = await caches();
    expect([c.ledger, c.career, c.team]).toEqual([25, 25, 25]);
    await assertInvariants();
  });

  it("undo reverses the exact row by ITS stamps — trio returns to pre-quest state", async () => {
    const { prisma } = await import("../lib/prisma");
    const { performUndoQuest } = await import("../lib/data/points");
    await performUndoQuest(ctx(), world.questTapId, DAY);

    const log = await prisma.questLog.findUnique({
      where: { userId_questId_day: { userId: world.userId, questId: world.questTapId, day: DAY } },
    });
    expect(log).toBeNull();
    const c = await caches();
    expect([c.ledger, c.career, c.team]).toEqual([5, 5, 5]);
    await assertInvariants();
  });

  it("measured quest logs the count and bumps the trio", async () => {
    const { prisma } = await import("../lib/prisma");
    const { performMeasuredQuest } = await import("../lib/data/points");
    const quest = await prisma.quest.findUniqueOrThrow({ where: { id: world.questMeasuredId } });
    await performMeasuredQuest(ctx(), quest, 36, DAY);

    const log = await prisma.questLog.findUniqueOrThrow({
      where: { userId_questId_day: { userId: world.userId, questId: quest.id, day: DAY } },
    });
    expect(log.actual).toBe(36);
    expect(log.membershipId).toBe(world.membershipId);
    const c = await caches();
    expect([c.ledger, c.career, c.team]).toEqual([35, 35, 35]);
    await assertInvariants();
  });

  it("Pro Review stamps and bumps the trio in the array transaction", async () => {
    const { prisma } = await import("../lib/prisma");
    const { performReview } = await import("../lib/data/points");
    await performReview(
      ctx(),
      { day: DAY, outcome: "YES", learned: "spacing", noteToTomorrow: null },
      10,
    );
    const review = await prisma.dailyReview.findUniqueOrThrow({
      where: { userId_day: { userId: world.userId, day: DAY } },
    });
    expect(review.profileId).toBe(world.profileId);
    const c = await caches();
    expect([c.ledger, c.career, c.team]).toEqual([45, 45, 45]);
    await assertInvariants();
  });

  it("coach adjustment (add then remove) stamps the target's membership and bumps the trio", async () => {
    const { performAdjustPoints } = await import("../lib/data/points");
    await performAdjustPoints({ id: world.userId, teamId: world.teamId }, 10, "Coach bonus");
    let c = await caches();
    expect([c.ledger, c.career, c.team]).toEqual([55, 55, 55]);

    await performAdjustPoints({ id: world.userId, teamId: world.teamId }, -15, "Missed practice");
    c = await caches();
    expect([c.ledger, c.career, c.team]).toEqual([40, 40, 40]);
    await assertInvariants();
  });

  it("no-team ruling: check-in AND quest stamp profileId + NULL membershipId", async () => {
    const { prisma } = await import("../lib/prisma");
    const { performCheckIn, performOneTapQuest } = await import("../lib/data/points");
    const offCtx = {
      user: { id: world.offUserId },
      profile: { id: world.offProfileId },
      membership: null,
    };
    await performCheckIn(offCtx, "offseason work", DAY, 5);
    const ledger = await prisma.pointsLedger.findFirstOrThrow({
      where: { userId: world.offUserId, source: "DAILY_CHECK_IN" },
    });
    expect(ledger.profileId).toBe(world.offProfileId);
    expect(ledger.membershipId).toBeNull(); // career points, no team board
    const offProfile = await prisma.profile.findUniqueOrThrow({ where: { id: world.offProfileId } });
    expect(offProfile.careerPoints).toBe(5);

    // A quest with no team still earns CAREER points (owner, 2026-10-09:
    // Personal Player Development) — profile stamped, no team board.
    const quest = await prisma.quest.findUniqueOrThrow({ where: { id: world.questTapId } });
    await performOneTapQuest(offCtx, quest, DAY);
    const qLedger = await prisma.pointsLedger.findFirstOrThrow({
      where: { userId: world.offUserId, source: "QUEST" },
    });
    expect(qLedger.profileId).toBe(world.offProfileId);
    expect(qLedger.membershipId).toBeNull();
    const offProfile2 = await prisma.profile.findUniqueOrThrow({ where: { id: world.offProfileId } });
    expect(offProfile2.careerPoints).toBe(25); // check-in 5 + quest 20: nothing lost
    await assertInvariants();
  });
});
