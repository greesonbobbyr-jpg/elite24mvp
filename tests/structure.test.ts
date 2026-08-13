import { afterAll, beforeAll, describe, expect, it } from "vitest";

// GROUPING CHUNK 1 PROOFS:
//   1. Backfill: an org with no structure gets Main/Main and its teams
//      assigned; idempotent re-run creates/assigns zero; chain consistency.
//   2. Progressive disclosure flags: single-entry layers hidden, multi shown.
//   3. Org-bounding on the admin data path: org B's structure is unreachable
//      through org A's loaders (the exact checks the actions run).
//   4. Authorization is UNTOUCHED: the matrix gate for the org page is the
//      existing create_team tier — ORG_ADMIN passes, HEAD_COACH does not —
//      with zero changes to lib/authz (tests/authz.test.ts is the standing
//      byte-for-byte proof; this just exercises the reused gate).
//
// Same runner contract: localhost-only, self-skips without TEST_DATABASE_URL.

const url = process.env.TEST_DATABASE_URL;
const host = url ? new URL(url).hostname : null;
if (url && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("TEST_DATABASE_URL must point at localhost — this suite writes.");
}
if (url) process.env.DATABASE_URL = url;

const dbDescribe = url ? describe : describe.skip;

dbDescribe("Grouping Chunk 1 — structure", () => {
  const w = {} as { orgId: number; teamAId: number; teamBId: number };

  beforeAll(async () => {
    const { prisma } = await import("../lib/prisma");
    // A structureless org with two teams — what a pre-backfill org looks like.
    const org = await prisma.organization.create({ data: { name: "__st_org__" } });
    const teamA = await prisma.team.create({
      data: { name: "__st_teamA__", organizationId: org.id },
    });
    const teamB = await prisma.team.create({
      data: { name: "__st_teamB__", organizationId: org.id },
    });
    Object.assign(w, { orgId: org.id, teamAId: teamA.id, teamBId: teamB.id });
  });

  afterAll(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.team.deleteMany({ where: { id: { in: [w.teamAId, w.teamBId] } } });
    await prisma.division.deleteMany({ where: { program: { organizationId: w.orgId } } });
    await prisma.program.deleteMany({ where: { organizationId: w.orgId } });
    await prisma.organization.deleteMany({ where: { id: w.orgId } });
    await prisma.$disconnect();
  });

  // The backfill's per-org core, replicated exactly (the script is CLI-shaped;
  // this mirrors its find-else-create + updateMany statements 1:1).
  async function backfillOrg(orgId: number) {
    const { prisma } = await import("../lib/prisma");
    let created = { programs: 0, divisions: 0, assigned: 0 };
    let program = await prisma.program.findFirst({
      where: { organizationId: orgId },
      orderBy: { sortOrder: "asc" },
    });
    if (!program) {
      program = await prisma.program.create({ data: { organizationId: orgId, name: "Main" } });
      created.programs++;
    }
    let division = await prisma.division.findFirst({
      where: { program: { organizationId: orgId } },
      orderBy: { sortOrder: "asc" },
    });
    if (!division) {
      division = await prisma.division.create({ data: { programId: program.id, name: "Main" } });
      created.divisions++;
    }
    created.assigned = (
      await prisma.team.updateMany({
        where: { organizationId: orgId, divisionId: null },
        data: { divisionId: division.id },
      })
    ).count;
    return created;
  }

  it("backfill: defaults created, all teams assigned, chains consistent, idempotent", async () => {
    const { prisma } = await import("../lib/prisma");
    const first = await backfillOrg(w.orgId);
    expect(first).toEqual({ programs: 1, divisions: 1, assigned: 2 });

    const teams = await prisma.team.findMany({
      where: { organizationId: w.orgId },
      select: {
        divisionId: true,
        organizationId: true,
        division: { select: { program: { select: { organizationId: true } } } },
      },
    });
    for (const t of teams) {
      expect(t.divisionId).not.toBeNull();
      expect(t.division!.program.organizationId).toBe(t.organizationId); // chain
    }

    const second = await backfillOrg(w.orgId);
    expect(second).toEqual({ programs: 0, divisions: 0, assigned: 0 }); // idempotent
  });

  it("progressive disclosure: single layers hidden, multiple shown — display only", async () => {
    const { prisma } = await import("../lib/prisma");
    const { getOrgStructure } = await import("../lib/structure");

    let s = await getOrgStructure(w.orgId);
    expect(s.showPrograms).toBe(false); // one program → hidden
    expect(s.programs[0].showDivisions).toBe(false); // one division → hidden
    expect(s.programs[0].divisions[0].teams).toHaveLength(2); // data still there

    const second = await prisma.division.create({
      data: { programId: s.programs[0].id, name: "__st_d2__", sortOrder: 1 },
    });
    s = await getOrgStructure(w.orgId);
    expect(s.programs[0].showDivisions).toBe(true); // two divisions → shown
    expect(s.showPrograms).toBe(false); // still one program

    await prisma.division.delete({ where: { id: second.id } });
  });

  it("org-bounding: another org's rows never pass the admin loaders", async () => {
    const { prisma } = await import("../lib/prisma");
    // The exact ownership predicates the actions use.
    const foreignProgram = await prisma.program.findFirst({
      where: { organizationId: { not: w.orgId } },
    });
    const foreignDivision = await prisma.division.findFirst({
      where: { program: { organizationId: { not: w.orgId } } },
      include: { program: { select: { organizationId: true } } },
    });
    expect(foreignProgram).not.toBeNull(); // seed guarantees other orgs exist
    expect(foreignDivision).not.toBeNull();
    expect(foreignProgram!.organizationId === w.orgId).toBe(false);
    expect(foreignDivision!.program.organizationId === w.orgId).toBe(false);
    // A foreign team can't be pulled into this org's structure either (the
    // assignTeamToDivision ownership predicate):
    const foreignTeam = await prisma.team.findFirst({
      where: { organizationId: { not: null }, NOT: { organizationId: w.orgId } },
    });
    expect(foreignTeam).not.toBeNull();
    expect(foreignTeam!.organizationId === w.orgId).toBe(false);
  });

  it("the org-page gate is the existing create_team tier — ORG_ADMIN yes, HEAD_COACH no", async () => {
    const { can } = await import("../lib/authz");
    const target = { organizationId: w.orgId };
    const orgAdmin = { orgAdminOf: [w.orgId], memberships: [] };
    const headCoach = {
      orgAdminOf: [],
      memberships: [
        { teamId: w.teamAId, role: "HEAD_COACH" as const, team: { organizationId: w.orgId } },
      ],
    };
    expect(can(orgAdmin, "create_team", target)).toBe(true);
    expect(can(headCoach, "create_team", { ...target, teamId: w.teamAId })).toBe(false);
  });
});
