import { afterAll, beforeAll, describe, expect, it } from "vitest";

// THE GROUP TREE BACKFILL (scripts/backfill-groups.ts, person-first plan
// Phase 2): Program → Division → Team becomes groups; a lone "Main" makes
// none (a one-team org looks exactly as before); teams follow; idempotent;
// verify passes.
//
// Same runner contract: localhost-only, self-skips without TEST_DATABASE_URL.

const url = process.env.TEST_DATABASE_URL;
const host = url ? new URL(url).hostname : null;
if (url && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("TEST_DATABASE_URL must point at localhost — this suite writes.");
}
if (url) process.env.DATABASE_URL = url;
const dbDescribe = url ? describe : describe.skip;

dbDescribe("group tree backfill (Program → Division → groups)", () => {
  const w = {} as { mainOrg: number; clubOrg: number; teams: number[] };

  beforeAll(async () => {
    const { prisma } = await import("../lib/prisma");
    // A one-team org with the hidden Main/Main skeleton…
    const main = await prisma.organization.create({ data: { name: "__bg_main__" } });
    const mp = await prisma.program.create({ data: { organizationId: main.id, name: "Main" } });
    const md = await prisma.division.create({ data: { programId: mp.id, name: "Main" } });
    const solo = await prisma.team.create({ data: { name: "__bg_solo__", organizationId: main.id, divisionId: md.id } });
    // …and a club: two programs, one with two divisions, one with a lone "Main".
    const club = await prisma.organization.create({ data: { name: "__bg_club__" } });
    const boys = await prisma.program.create({ data: { organizationId: club.id, name: "Boys", sortOrder: 0 } });
    const girls = await prisma.program.create({ data: { organizationId: club.id, name: "Girls", sortOrder: 1 } });
    const u12 = await prisma.division.create({ data: { programId: boys.id, name: "12U", sortOrder: 0 } });
    const u13 = await prisma.division.create({ data: { programId: boys.id, name: "13U", sortOrder: 1 } });
    const gMain = await prisma.division.create({ data: { programId: girls.id, name: "Main" } });
    const t1 = await prisma.team.create({ data: { name: "__bg_12__", organizationId: club.id, divisionId: u12.id } });
    const t2 = await prisma.team.create({ data: { name: "__bg_13__", organizationId: club.id, divisionId: u13.id } });
    const t3 = await prisma.team.create({ data: { name: "__bg_girls__", organizationId: club.id, divisionId: gMain.id } });
    Object.assign(w, { mainOrg: main.id, clubOrg: club.id, teams: [solo.id, t1.id, t2.id, t3.id] });
  });

  afterAll(async () => {
    const { prisma } = await import("../lib/prisma");
    const orgs = [w.mainOrg, w.clubOrg];
    await prisma.team.deleteMany({ where: { id: { in: w.teams } } });
    for (const depth of [2, 1]) await prisma.group.deleteMany({ where: { organizationId: { in: orgs }, depth } });
    await prisma.division.deleteMany({ where: { program: { organizationId: { in: orgs } } } });
    await prisma.program.deleteMany({ where: { organizationId: { in: orgs } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgs } } });
    await prisma.$disconnect();
  });

  it("creates the club's groups, none for Main/Main; teams follow; idempotent; verify passes", async () => {
    const { prisma } = await import("../lib/prisma");
    const { executeBackfill, planBackfill, verifyBackfill } = await import("../scripts/backfill-groups");
    const first = await executeBackfill(prisma as never);
    expect(first.plan.groupsToCreate).toBe(0);
    expect(first.plan.teamsToMove).toBe(0);

    expect(await prisma.group.count({ where: { organizationId: w.mainOrg } })).toBe(0);
    const solo = await prisma.team.findUniqueOrThrow({ where: { id: w.teams[0] } });
    expect(solo.groupId).toBeNull(); // looks exactly as before: directly under the org

    const groups = await prisma.group.findMany({ where: { organizationId: w.clubOrg }, orderBy: [{ depth: "asc" }, { sortOrder: "asc" }] });
    expect(groups.map((x) => [x.name, x.depth])).toEqual([["Boys", 1], ["Girls", 1], ["12U", 2], ["13U", 2]]);
    const teams = await prisma.team.findMany({ where: { id: { in: w.teams.slice(1) } }, orderBy: { id: "asc" } });
    const byName = new Map(groups.map((x) => [x.name, x.id]));
    expect(teams.map((t) => t.groupId)).toEqual([byName.get("12U"), byName.get("13U"), byName.get("Girls")]);

    const again = await planBackfill(prisma as never);
    expect([again.groupsToCreate, again.teamsToMove]).toEqual([0, 0]);
    expect(await verifyBackfill(prisma as never)).toEqual([]);
  });
});
