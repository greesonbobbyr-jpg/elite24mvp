import { afterAll, describe, expect, it } from "vitest";

// GROUPING CHUNK 2 PROOFS — the read-only Org View loader + the org tree on
// the seeded 12U–17U Mustang club:
//   1. Staff ordered HC → AC → GM; empty roles simply absent; players ordered
//      by card level (career points), each with their place on the team
//      board — the same place the team leaderboard gives them.
//   2. Owner = the EARLIEST unrevoked ORG_ADMIN grant (seed: Gary), with the
//      membership-less admin (Alex) listed too.
//   3. Rollups match the seeded club; the two-team athlete counts once.
//   4. The tree: divisions row, no program row; the team with no head coach;
//      the two-team athlete findable under both teams; the hidden program
//      never searchable.
//   5. FIELD ALLOWLIST: the serialized payload contains card info only — no
//      dream, reflections, contact, or guardian data, ever — and photos go
//      out as /api/photo URLs, never inline data.
//   6. Disclosure flags are passed through from lib/structure VERBATIM.
//   7. The gate is the existing create_team tier (ORG_ADMIN yes, staff no) —
//      lib/authz untouched (tests/authz.test.ts remains the standing proof).
//
// Same runner contract: localhost-only, self-skips without TEST_DATABASE_URL.

const url = process.env.TEST_DATABASE_URL;
const host = url ? new URL(url).hostname : null;
if (url && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("TEST_DATABASE_URL must point at localhost — this suite writes.");
}
if (url) process.env.DATABASE_URL = url;

const dbDescribe = url ? describe : describe.skip;

dbDescribe("Grouping Chunk 2 — Org View loader", () => {
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
  const teamsOf = (data: Data) => data.programs.flatMap((p) => p.divisions).flatMap((d) => d.teams);

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
    expect(data.programs).toHaveLength(1);
    expect(data.programs[0].divisions.map((d) => d.name)).toEqual(["12U", "13U", "14U", "15U", "16U", "17U"]);
    expect(data.totals.teamCount).toBe(14); // Varsity + JV + 12 club teams
    expect(data.programs[0].teamCount).toBe(14);
    const memberships = teamsOf(data).reduce((sum, t) => sum + t.playerCount, 0);
    expect(data.totals.playerCount).toBe(memberships - 1); // Casey: two teams, one player
  });

  it("the tree: divisions, no program row; an empty head-coach seat; search", async () => {
    const { buildOrgTree, search, searchIndex } = await import("../lib/orgtree");
    const data = await mustangData();
    const root = buildOrgTree(data);
    if (root.kind !== "groups") throw new Error("a divisions row expected");
    expect(root.groups.map((g) => g.name)).toEqual(["12U", "13U", "14U", "15U", "16U", "17U"]);

    const u14 = root.groups.find((g) => g.name === "14U")!.next;
    if (u14.kind !== "teams") throw new Error("teams expected");
    expect(u14.teams.map((t) => t.label)).toEqual(["Mustang Black", "Mustang Red", "Mustang White"]);
    expect(u14.teams.find((t) => t.label === "Mustang White")!.headCoach).toBeNull();

    const index = searchIndex(root, data.owner);
    expect(search(index, "Casey Rivers").map((h) => h.sub).sort()).toEqual(["Mustang Broncos", "Mustang JV"]);
    expect(search(index, "Boys Basketball")).toEqual([]); // the hidden program
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

  it("disclosure flags pass through from lib/structure verbatim", async () => {
    const { prisma } = await import("../lib/prisma");
    const { getOrgStructure } = await import("../lib/structure");
    const { getOrgViewData } = await import("../lib/orgview");
    const orgs = (await prisma.organization.findMany()).filter((o) => !o.name.includes("__"));
    for (const org of orgs) {
      const [structure, view] = await Promise.all([
        getOrgStructure(org.id),
        getOrgViewData(org.id),
      ]);
      expect(view.showPrograms).toBe(structure.showPrograms);
      for (const p of structure.programs) {
        expect(view.programs.find((vp) => vp.id === p.id)?.showDivisions).toBe(p.showDivisions);
      }
    }
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
