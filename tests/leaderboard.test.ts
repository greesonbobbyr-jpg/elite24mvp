import { afterAll, beforeAll, describe, expect, it } from "vitest";

// LEADERBOARD PROOFS on the real local database — the owner's watch-points:
//   1. Existing data: the board is the team's active players, each with
//      their membership's points.
//   2. An ENDED membership disappears from the board; its ledger rows and the
//      athlete's careerPoints are untouched.
//   3. Tie-aware 1224 competition ranking survives the move.
//   4. Weekly board: the Monday-12am boundary (app timezone) still splits
//      weeks correctly when summing by membershipId.
//   5. careerPoints crosses orgs (combined tier) while each org's board shows
//      only its own membership's points.
//   6. Offseason rows (NULL membershipId) count toward career/tier and toward
//      NO team board.
//
// Same runner contract: localhost-only, self-skips without TEST_DATABASE_URL.

const url = process.env.TEST_DATABASE_URL;
const host = url ? new URL(url).hostname : null;
if (url && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("TEST_DATABASE_URL must point at localhost — this suite writes.");
}
if (url) process.env.DATABASE_URL = url;

const dbDescribe = url ? describe : describe.skip;

dbDescribe("Stage 4d leaderboards + points economy", () => {
  // Isolated two-org world so points are fully controlled.
  const w = {} as {
    orgA: number; orgB: number; seasonA: number; seasonB: number;
    teamA: number; teamB: number;
    userIds: number[]; profileIds: number[]; membershipIds: number[];
  };

  beforeAll(async () => {
    const { prisma } = await import("../lib/prisma");
    // Purge residue from any previously failed run (idempotent setup).
    await prisma.membership.deleteMany({ where: { team: { name: { startsWith: "__lb_" } } } });
    await prisma.pointsLedger.deleteMany({ where: { user: { name: { startsWith: "__lb_" } } } });
    await prisma.user.deleteMany({ where: { name: { startsWith: "__lb_" } } });
    await prisma.profile.deleteMany({ where: { name: { startsWith: "__lb_" } } });
    await prisma.team.deleteMany({ where: { name: { startsWith: "__lb_" } } });
    await prisma.season.deleteMany({ where: { organization: { name: { startsWith: "__lb_" } } } });
    await prisma.organization.deleteMany({ where: { name: { startsWith: "__lb_" } } });

    const orgA = await prisma.organization.create({ data: { name: "__lb_orgA__" } });
    const orgB = await prisma.organization.create({ data: { name: "__lb_orgB__" } });
    const seasonA = await prisma.season.create({
      data: { organizationId: orgA.id, name: "__lb__", isCurrent: true },
    });
    const seasonB = await prisma.season.create({
      data: { organizationId: orgB.id, name: "__lb__", isCurrent: true },
    });
    const teamA = await prisma.team.create({ data: { name: "__lb_teamA__", organizationId: orgA.id } });
    const teamB = await prisma.team.create({ data: { name: "__lb_teamB__", organizationId: orgB.id } });
    Object.assign(w, {
      orgA: orgA.id, orgB: orgB.id, seasonA: seasonA.id, seasonB: seasonB.id,
      teamA: teamA.id, teamB: teamB.id, userIds: [], profileIds: [], membershipIds: [],
    });
  });

  afterAll(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.user.deleteMany({ where: { id: { in: w.userIds } } }); // cascades ledger
    await prisma.membership.deleteMany({ where: { id: { in: w.membershipIds } } });
    await prisma.profile.deleteMany({ where: { id: { in: w.profileIds } } });
    await prisma.season.deleteMany({ where: { id: { in: [w.seasonA, w.seasonB] } } });
    await prisma.team.deleteMany({ where: { id: { in: [w.teamA, w.teamB] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [w.orgA, w.orgB] } } });
    await prisma.$disconnect();
  });

  async function makePlayer(name: string, teamId: number, seasonId: number, points = 0) {
    const { prisma } = await import("../lib/prisma");
    const user = await prisma.user.create({ data: { name } });
    const profile = await prisma.profile.create({
      data: { userId: user.id, name, careerPoints: points, dream: "t", setupCompletedAt: new Date() },
    });
    const membership = await prisma.membership.create({
      data: { profileId: profile.id, teamId, seasonId, role: "PLAYER", points },
    });
    w.userIds.push(user.id);
    w.profileIds.push(profile.id);
    w.membershipIds.push(membership.id);
    return { user, profile, membership };
  }

  it("existing data: the board is the team's active players, each with their membership's points", async () => {
    const { prisma } = await import("../lib/prisma");
    const { getTeamRanking } = await import("../lib/leaderboard");
    // A clean single-team org (the seeded OKC Thunder): no ended memberships,
    // nobody on two teams — what production data looks like.
    const cleanOrg = (
      await prisma.organization.findMany({
        where: { id: { notIn: [w.orgA, w.orgB] } },
        include: { _count: { select: { teams: true } }, teams: { select: { id: true } } },
      })
    ).find((o) => o._count.teams === 1);
    expect(cleanOrg).toBeDefined();
    const team = await prisma.team.findUniqueOrThrow({ where: { id: cleanOrg!.teams[0].id } });
    const board = await getTeamRanking(team.id);
    const roster = await prisma.membership.findMany({
      where: { teamId: team.id, role: "PLAYER", endedAt: null, season: { isCurrent: true } },
      select: { points: true, profile: { select: { userId: true } } },
    });
    expect(board.length).toBe(roster.length);
    const points = new Map(roster.map((m) => [m.profile.userId, m.points]));
    for (const row of board) {
      expect(row.points).toBe(points.get(row.id));
    }
    // Ranks strictly non-decreasing and 1-based (1224 shape).
    expect(board[0]?.rank).toBe(1);
  });

  it("tie-aware 1224 ranking: 100, 80, 80, 60 → ranks 1, 2, 2, 4", async () => {
    const { getTeamRanking } = await import("../lib/leaderboard");
    await makePlayer("__lb_p100__", w.teamA, w.seasonA, 100);
    await makePlayer("__lb_p80a__", w.teamA, w.seasonA, 80);
    await makePlayer("__lb_p80b__", w.teamA, w.seasonA, 80);
    await makePlayer("__lb_p60__", w.teamA, w.seasonA, 60);

    const board = await getTeamRanking(w.teamA);
    expect(board.map((p) => [p.points, p.rank])).toEqual([
      [100, 1], [80, 2], [80, 2], [60, 4],
    ]);
  });

  it("an ENDED membership leaves the board; ledger + careerPoints untouched", async () => {
    const { prisma } = await import("../lib/prisma");
    const { getTeamRanking } = await import("../lib/leaderboard");
    const { performAdjustPoints } = await import("../lib/data/points");

    const p = await makePlayer("__lb_ended__", w.teamA, w.seasonA);
    await performAdjustPoints({ id: p.user.id, teamId: w.teamA }, 50, "test");

    let board = await getTeamRanking(w.teamA);
    expect(board.find((r) => r.id === p.user.id)?.points).toBe(50);

    await prisma.membership.update({
      where: { id: p.membership.id },
      data: { endedAt: new Date() },
    });
    board = await getTeamRanking(w.teamA);
    expect(board.find((r) => r.id === p.user.id)).toBeUndefined(); // off the board

    // Ledger rows and career total are UNTOUCHED by the ending.
    const ledger = await prisma.pointsLedger.findMany({ where: { profileId: p.profile.id } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].amount).toBe(50);
    const profile = await prisma.profile.findUniqueOrThrow({ where: { id: p.profile.id } });
    expect(profile.careerPoints).toBe(50);
  });

  it("weekly board: Monday-12am boundary splits weeks when summing by membership", async () => {
    const { prisma } = await import("../lib/prisma");
    const { getWeeklyRanking } = await import("../lib/leaderboard");
    const { todayKey, mondayOf, zonedStartOfDay } = await import("../lib/daykey");

    const p = await makePlayer("__lb_weekly__", w.teamA, w.seasonA);
    const weekStart = zonedStartOfDay(mondayOf(todayKey()));

    // One row exactly AT the boundary (this week), one 1s BEFORE it (last week).
    await prisma.pointsLedger.create({
      data: {
        userId: p.user.id, profileId: p.profile.id, membershipId: p.membership.id,
        amount: 7, reason: "in-week", source: "COACH_ADJUSTMENT", createdAt: weekStart,
      },
    });
    await prisma.pointsLedger.create({
      data: {
        userId: p.user.id, profileId: p.profile.id, membershipId: p.membership.id,
        amount: 3, reason: "last-week", source: "COACH_ADJUSTMENT",
        createdAt: new Date(weekStart.getTime() - 1000),
      },
    });

    const weekly = await getWeeklyRanking(w.teamA);
    const mine = weekly.find((r) => r.id === p.user.id)!;
    expect(mine.weekPoints).toBe(7); // boundary row included
    expect(mine.lastWeekPoints).toBe(3); // pre-boundary row in LAST week
    expect(mine.delta).toBe(4);
  });

  it("careerPoints crosses orgs (combined tier); each org's board shows only its own membership", async () => {
    const { prisma } = await import("../lib/prisma");
    const { getTeamRanking } = await import("../lib/leaderboard");
    const { getPointsTotal } = await import("../lib/points");
    const { tierForPoints } = await import("../lib/cardTheme");

    // One person, two orgs: 30 pts with org A, 20 with org B.
    const p = await makePlayer("__lb_crossorg__", w.teamA, w.seasonA);
    const mB = await prisma.membership.create({
      data: { profileId: p.profile.id, teamId: w.teamB, seasonId: w.seasonB, role: "PLAYER" },
    });
    w.membershipIds.push(mB.id);
    for (const [membershipId, amount] of [[p.membership.id, 30], [mB.id, 20]] as const) {
      await prisma.pointsLedger.create({
        data: {
          userId: p.user.id, profileId: p.profile.id, membershipId,
          amount, reason: "x", source: "COACH_ADJUSTMENT",
        },
      });
      await prisma.membership.update({
        where: { id: membershipId },
        data: { points: { increment: amount } },
      });
    }
    await prisma.profile.update({
      where: { id: p.profile.id },
      data: { careerPoints: { increment: 50 } },
    });

    const boardA = await getTeamRanking(w.teamA);
    const boardB = await getTeamRanking(w.teamB);
    expect(boardA.find((r) => r.id === p.user.id)?.points).toBe(30); // org A only
    expect(boardB.find((r) => r.id === p.user.id)?.points).toBe(20); // org B only

    const career = await getPointsTotal(p.user.id);
    expect(career).toBe(50); // combined — the one deliberate cross-org surface
    expect(tierForPoints(career)).toEqual(tierForPoints(30 + 20));
  });

  it("offseason rows (NULL membershipId) count toward career/tier and NO board", async () => {
    const { prisma } = await import("../lib/prisma");
    const { getTeamRanking, getWeeklyRanking } = await import("../lib/leaderboard");
    const { getPointsTotal } = await import("../lib/points");
    const { performCheckIn } = await import("../lib/data/points");

    // Profile with NO membership at all (true offseason).
    const user = await prisma.user.create({ data: { name: "__lb_offseason__" } });
    const profile = await prisma.profile.create({ data: { userId: user.id, name: user.name } });
    w.userIds.push(user.id);
    w.profileIds.push(profile.id);

    await performCheckIn(
      { user: { id: user.id }, profile: { id: profile.id }, membership: null },
      "offseason grind", "2031-03-01", 10,
    );

    const ledger = await prisma.pointsLedger.findFirstOrThrow({ where: { profileId: profile.id } });
    expect(ledger.membershipId).toBeNull();
    expect(await getPointsTotal(user.id)).toBe(10); // career/tier counts it

    const board = await getTeamRanking(w.teamA);
    const weekly = await getWeeklyRanking(w.teamA);
    expect(board.find((r) => r.id === user.id)).toBeUndefined(); // no board
    expect(weekly.find((r) => r.id === user.id)).toBeUndefined(); // no weekly board
  });
});
