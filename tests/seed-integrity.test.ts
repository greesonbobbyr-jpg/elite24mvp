import { afterAll, describe, expect, it } from "vitest";

// STAGE 5 SEED INTEGRITY: the seed must exercise the whole matrix and the
// switcher, with every point cache equal to its ledger sum.
//   - an org with MULTIPLE teams (org-wide staff access is real)
//   - an ASSISTANT_COACH and a GENERAL_MANAGER
//   - an ORG_ADMIN with no membership
//   - a TWO-TEAM athlete (defaulting to the team they joined last)
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

  it("group tree: every grouped team's group is in its OWN org; depths are consistent", async () => {
    const { prisma } = await import("../lib/prisma");
    const teams = await prisma.team.findMany({
      where: { groupId: { not: null } },
      select: { organizationId: true, group: { select: { organizationId: true } } },
    });
    expect(teams.length).toBeGreaterThan(0);
    for (const t of teams) expect(t.group!.organizationId).toBe(t.organizationId);
    const groups = await prisma.group.findMany({ include: { parent: true } });
    for (const g of groups) {
      expect(g.depth).toBe(g.parent ? g.parent.depth + 1 : 1);
      if (g.parent) expect(g.parent.organizationId).toBe(g.organizationId);
      expect(g.depth).toBeLessThanOrEqual(4);
    }
    // The three seeded shapes: Mustang (Boys / Girls), Thunder (none), Lincoln (schools).
    const tops = await prisma.group.findMany({ where: { parentId: null }, select: { name: true }, orderBy: { name: "asc" } });
    expect(tops.map((t) => t.name)).toEqual(["Boys", "Girls", "Lincoln High", "Lincoln Middle"]);
  });

  it("the two-team athlete's cookie-less default is the team they joined last; the cookie flips it", async () => {
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
    const latest = [...athlete.memberships].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime() || b.id - a.id)[0];
    expect(ctx!.membership?.id).toBe(latest.id);
    // And the cookie flips it (the switcher's mechanism).
    const other = athlete.memberships.find((m) => m.id !== latest.id)!;
    const flipped = await resolveContextForUser(athlete.userId!, String(other.id));
    expect(flipped!.membership?.id).toBe(other.id);
  });

  it("both point caches equal their ledger sums for every row in the DB", async () => {
    const { prisma } = await import("../lib/prisma");

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
