import { afterAll, describe, expect, it } from "vitest";

// OWNS the "exactly one current season per organization" invariant
// (HIERARCHY_PLAN.md §2.10 rulings): Prisma can't express a partial unique
// index, so the invariant is app-enforced by lib/seasons.startNewSeason — and
// this test is what keeps it true.
//
// Runs against the throwaway local Postgres (scripts/localpg.ts) ONLY:
//   TEST_DATABASE_URL=postgresql://postgres:localtest@localhost:5433/e24local npm test
// Self-skips when TEST_DATABASE_URL is absent; refuses non-localhost hosts
// because it writes.

const url = process.env.TEST_DATABASE_URL;
const host = url ? new URL(url).hostname : null;
if (url && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("TEST_DATABASE_URL must point at localhost — this suite writes.");
}
if (url) process.env.DATABASE_URL = url;

const dbDescribe = url ? describe : describe.skip;

dbDescribe("one current season per org", () => {
  afterAll(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });

  it("holds for every organization in the database (post-backfill sweep)", async () => {
    const { prisma } = await import("../lib/prisma");
    const orgs = await prisma.organization.findMany({
      select: { id: true, name: true, _count: { select: { seasons: { where: { isCurrent: true } } } } },
    });
    const bad = orgs.filter((o) => o._count.seasons !== 1);
    expect(bad, `orgs violating the invariant: ${bad.map((o) => o.name).join(", ")}`).toEqual([]);
  });

  it("startNewSeason retires the old current atomically — never zero, never two", async () => {
    const { prisma } = await import("../lib/prisma");
    const { startNewSeason } = await import("../lib/seasons");

    const org = await prisma.organization.create({ data: { name: "__test_season_invariant__" } });
    try {
      await startNewSeason(org.id, "2026");
      await startNewSeason(org.id, "2027");
      await startNewSeason(org.id, "2028");

      const seasons = await prisma.season.findMany({ where: { organizationId: org.id } });
      expect(seasons).toHaveLength(3);
      const current = seasons.filter((s) => s.isCurrent);
      expect(current).toHaveLength(1);
      expect(current[0].name).toBe("2028");
    } finally {
      await prisma.season.deleteMany({ where: { organizationId: org.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    }
  });
});
