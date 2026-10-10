import { afterAll, describe, expect, it } from "vitest";

// ORG VIEW PROOFS — the read-only loader + the org tree on the seeded Mustang
// club (group tree: Boys → 12U–17U, Girls → 15U, 16U):
//   1. Staff ordered HC → AC → GM; empty roles simply absent; players ordered
//      by card level (career points), each with their place on the team
//      board — the same place the team leaderboard gives them.
//   2. Owner = the EARLIEST unrevoked ORG_ADMIN grant (seed: Gary), with the
//      membership-less admin (Alex) listed too.
//   3. Rollups match the seeded club; the two-team athlete counts once.
//   4. The tree: a Boys / Girls row, then age groups; the team with no head
//      coach; the two-team athlete findable under both teams.
//   5. FIELD ALLOWLIST: the serialized payload contains card info only — no
//      dream, reflections, contact, or guardian data, ever — and photos go
//      out as /api/photo URLs, never inline data.
//   6. A group admin's view (branch) holds only their branch — no other team,
//      no other group, nobody from outside it.
//   7. The gate is the create_team tier (ORG_ADMIN yes, staff no) —
//      tests/authz.test.ts remains the standing proof.
//
// Same runner contract: localhost-only, self-skips without TEST_DATABASE_URL.

const url = process.env.TEST_DATABASE_URL;
const host = url ? new URL(url).hostname : null;
if (url && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("TEST_DATABASE_URL must point at localhost — this suite writes.");
}
if (url) process.env.DATABASE_URL = url;

const dbDescribe = url ? describe : describe.skip;

dbDescribe("Org View loader", () => {
  afterAll(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });

  async function mustangData() {
    const { prisma } = await import("../lib/prisma");
    const { getOrgViewData } = await import("../lib/orgview");
    const org = (await prisma.organization.findMany())
      .filter((o) => !o.name.includes("__"))
      .find((o) => o.name.includes("Mustang"))!;
    expect(org).toBeDefined();
    return getOrgViewData(org.id);
  }
  type Data = Awaited<ReturnType<typeof mustangData>>;
  const teamsOf = (data: Data) => data.teams;

  it("staff ordered HC → AC → GM, empty roles absent; players by card level", async () => {
    const data = await mustangData();
    const varsity = teamsOf(data).find((t) => t.name === "Mustang Broncos")!;
    expect(varsity).toBeDefined();
    // Seed: Gary (HC), Dana (AC), Morgan (GM) on Varsity — exactly this order.
    expect(varsity.staff.map((s) => s.role)).toEqual(["HEAD_COACH", "ASSISTANT_COACH", "GENERAL_MANAGER"]);
    // JV has only a head coach — no AC/GM entries at all.
    const jv = teamsOf(data).find((t) => t.name === "Mustang JV")!;
    expect(jv.staff.map((s) => s.role)).toEqual(["HEAD_COACH"]);

    const career = varsity.players.map((p) => p.careerPoints);
    expect([...career].sort((a, b) => b - a)).toEqual(career);
    expect(career[0]).toBeGreaterThan(career[career.length - 1]); // the seed spreads the levels

    const { getTeamRanking } = await import("../lib/leaderboard");
    const board = await getTeamRanking(varsity.id);
    for (const p of varsity.players) {
      expect(p.teamRank, p.name).toBe(board.find((b) => b.id === p.userId)?.rank);
    }
  });

  it("owner = earliest ORG_ADMIN grant (Gary); membership-less admin listed", async () => {
    const data = await mustangData();
    expect(data.owner?.name).toBe("Coach Gary");
    expect(data.admins.map((a) => a.name)).toContain("Alex Vaughn");
  });

  it("rollups match the seeded club; the two-team athlete counts once", async () => {
    const data = await mustangData();
    expect(data.groups.filter((g) => g.parentId == null).map((g) => g.name)).toEqual(["Boys", "Girls"]);
    expect(data.totals.teamCount).toBe(16); // Varsity + JV + 12 club teams + 2 Girls teams
    expect(data.teams.every((t) => t.groupId != null)).toBe(true);
    const memberships = teamsOf(data).reduce((sum, t) => sum + t.playerCount, 0);
    expect(data.totals.playerCount).toBe(memberships - 1); // Casey: two teams, one player
  });

  it("the tree: Boys / Girls, then age groups; an empty head-coach seat; search", async () => {
    const { buildOrgTree, search, searchIndex } = await import("../lib/orgtree");
    const data = await mustangData();
    const root = buildOrgTree(data);
    if (root.kind !== "groups") throw new Error("a Boys / Girls row expected");
    expect(root.groups.map((g) => g.name)).toEqual(["Boys", "Girls"]);
    expect(root.groups.map((g) => g.teamCount)).toEqual([14, 2]);
    const boys = root.groups[0].next;
    if (boys.kind !== "groups") throw new Error("an age-group row expected");
    expect(boys.groups.map((g) => g.name)).toEqual(["12U", "13U", "14U", "15U", "16U", "17U"]);

    const u14 = boys.groups.find((g) => g.name === "14U")!.next;
    if (u14.kind !== "teams") throw new Error("teams expected");
    expect(u14.teams.map((t) => t.label)).toEqual(["Mustang Black", "Mustang Red", "Mustang White"]);
    expect(u14.teams.find((t) => t.label === "Mustang White")!.headCoach).toBeNull();

    const index = searchIndex(root, data.owner);
    expect(search(index, "Casey Rivers").map((h) => h.sub).sort()).toEqual(["Mustang Broncos", "Mustang JV"]);
    expect(search(index, "Girls")[0]).toMatchObject({ kind: "Boys or Girls", label: "Girls" });
    expect(new Set(index.map((h) => h.key)).size).toBe(index.length);
  });

  it("FIELD ALLOWLIST: card info only; photos as /api/photo URLs", async () => {
    const data = await mustangData();
    const payload = JSON.stringify(data);
    for (const forbidden of [
      '"dream"', '"reflection"', '"learned"', '"noteToTomorrow"',
      '"guardian', '"phone"', '"email"', '"dob"', '"address',
      '"pointsPerGame"', '"heightInches"', "data:image",
    ]) {
      expect(payload.includes(forbidden), `payload leaked ${forbidden}`).toBe(false);
    }
    const photos = teamsOf(data).flatMap((t) => t.players).map((p) => p.photoCutoutUrl).filter(Boolean);
    expect(photos.length).toBeGreaterThan(0); // the seed's sample portraits
    for (const photo of photos) expect(photo).toMatch(/^\/api\/photo\/\d+\?cut=1&v=/);
  });

  it("a group admin's branch holds only that branch", async () => {
    const { prisma } = await import("../lib/prisma");
    const { getOrgViewData } = await import("../lib/orgview");
    const girls = await prisma.group.findFirstOrThrow({ where: { name: "Girls", organization: { name: { contains: "Mustang" } } } });
    const data = await getOrgViewData(girls.organizationId, { branch: [girls.id] });
    expect(data.groups.map((g) => g.name).sort()).toEqual(["15U", "16U", "Girls"]);
    expect(data.teams.map((t) => t.name).sort()).toEqual(["15U Mustang Girls", "16U Mustang Girls"]);
    const people = JSON.stringify(data.teams);
    expect(people).not.toContain("Jordan Carter"); // a Boys player
    expect(data.totals.teamCount).toBe(2);
  });

  it("gate: create_team tier — ORG_ADMIN passes, every team-staff role is denied", async () => {
    const { can } = await import("../lib/authz");
    const { prisma } = await import("../lib/prisma");
    const org = (await prisma.organization.findMany()).find((o) => o.name.includes("Mustang"))!;
    const team = await prisma.team.findFirstOrThrow({ where: { organizationId: org.id } });
    const target = { organizationId: org.id };
    expect(can({ orgAdminOf: [org.id], memberships: [] }, "create_team", target)).toBe(true);
    for (const role of ["HEAD_COACH", "ASSISTANT_COACH", "GENERAL_MANAGER", "PLAYER"] as const) {
      const ctx = {
        orgAdminOf: [],
        memberships: [{ teamId: team.id, role, team: { organizationId: org.id } }],
      };
      expect(can(ctx, "create_team", { ...target, teamId: team.id }), role).toBe(false);
    }
  });
});
