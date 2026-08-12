import { afterAll, describe, expect, it } from "vitest";

// STAGE 5 SEED INTEGRITY: the seed must exercise the whole matrix and the
// switcher, with every point cache equal to its ledger sum.
//   - an org with MULTIPLE teams (org-wide staff access is real)
//   - an ASSISTANT_COACH and a GENERAL_MANAGER
//   - an ORG_ADMIN with no membership
//   - a TWO-TEAM athlete (defaulting to their legacy-anchor team)
//   - an ENDED membership
//   - DailyReview rows
// Runs against whatever the local DB holds — seed v2 must satisfy all of it.

const url = process.env.TEST_DATABASE_URL;
const host = url ? new URL(url).hostname : null;
if (url && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("TEST_DATABASE_URL must point at localhost — this suite writes.");
}
if (url) process.env.DATABASE_URL = url;

const dbDescribe = url ? describe : describe.skip;

dbDescribe("Stage 5 seed integrity", () => {
  afterAll(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });

  it("fixtures: multi-team org, AC + GM, membership-less org admin, two-team athlete, ended membership, reviews", async () => {
    const { prisma } = await import("../lib/prisma");

    // (JS filter — Prisma doesn't escape `_` in contains/startsWith.)
    const orgs = (
      await prisma.organization.findMany({
        include: { _count: { select: { teams: true } } },
      })
    ).filter((o) => !o.name.includes("__"));
    expect(orgs.some((o) => o._count.teams >= 2)).toBe(true);

    expect(await prisma.membership.count({ where: { role: "ASSISTANT_COACH", endedAt: null } })).toBeGreaterThan(0);
    expect(await prisma.membership.count({ where: { role: "GENERAL_MANAGER", endedAt: null } })).toBeGreaterThan(0);

    const admins = await prisma.roleAssignment.findMany({
      where: { role: "ORG_ADMIN", revokedAt: null },
      include: { profile: { select: { memberships: { where: { endedAt: null }, select: { id: true } } } } },
    });
    expect(admins.some((a) => a.profile.memberships.length === 0)).toBe(true); // org authority, no roster spot

    const twoTeam = await prisma.profile.findFirst({
      where: { memberships: { some: {} } },
      include: { memberships: { where: { endedAt: null, season: { isCurrent: true } } } },
      orderBy: { id: "asc" },
    });
    const multi = await prisma.profile.findMany({
      include: { memberships: { where: { endedAt: null, season: { isCurrent: true } } } },
    });
    expect(multi.some((p) => p.memberships.length >= 2)).toBe(true);
    void twoTeam;

    expect(await prisma.membership.count({ where: { endedAt: { not: null } } })).toBeGreaterThan(0);
    expect(await prisma.dailyReview.count()).toBeGreaterThan(0); // the old gap, closed
  });

  it("the two-team athlete's cookie-less default acting team matches their legacy anchor", async () => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser } = await import("../lib/context");
    const athlete = (
      await prisma.profile.findMany({
        where: { userId: { not: null } },
        include: { memberships: { where: { endedAt: null, season: { isCurrent: true } } } },
      })
    ).find((p) => p.memberships.length >= 2)!;
    expect(athlete).toBeDefined();
    const ctx = await resolveContextForUser(athlete.userId!);
    expect(ctx!.membership?.teamId).toBe(ctx!.user.teamId);
    // And the cookie flips it (the switcher's mechanism).
    const other = athlete.memberships.find((m) => m.teamId !== ctx!.user.teamId)!;
    const flipped = await resolveContextForUser(athlete.userId!, String(other.id));
    expect(flipped!.membership?.id).toBe(other.id);
  });

  it("ALL THREE point caches equal their ledger sums for every row in the DB", async () => {
    const { prisma } = await import("../lib/prisma");

    const byUser = new Map(
      (await prisma.pointsLedger.groupBy({ by: ["userId"], _sum: { amount: true } })).map(
        (r) => [r.userId, r._sum.amount ?? 0],
      ),
    );
    for (const pp of await prisma.playerProfile.findMany({ select: { userId: true, points: true } })) {
      expect(pp.points, `legacy cache user ${pp.userId}`).toBe(byUser.get(pp.userId) ?? 0);
    }

    const byProfile = new Map(
      (await prisma.pointsLedger.groupBy({ by: ["profileId"], _sum: { amount: true } })).map(
        (r) => [r.profileId, r._sum.amount ?? 0],
      ),
    );
    for (const p of await prisma.profile.findMany({ select: { id: true, careerPoints: true } })) {
      expect(p.careerPoints, `careerPoints profile ${p.id}`).toBe(byProfile.get(p.id) ?? 0);
    }

    const byMembership = new Map(
      (await prisma.pointsLedger.groupBy({ by: ["membershipId"], _sum: { amount: true } })).map(
        (r) => [r.membershipId, r._sum.amount ?? 0],
      ),
    );
    for (const m of await prisma.membership.findMany({ select: { id: true, points: true } })) {
      expect(m.points, `membership ${m.id}`).toBe(byMembership.get(m.id) ?? 0);
    }
  });
});
