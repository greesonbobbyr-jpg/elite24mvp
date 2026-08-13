import { afterAll, describe, expect, it } from "vitest";

// GROUPING CHUNK 2 PROOFS — the read-only Org View loader:
//   1. Staff ordered HC → AC → GM; empty roles simply absent; players carry
//      membership (board) points.
//   2. Owner = the EARLIEST unrevoked ORG_ADMIN grant (seed: Gary), with the
//      membership-less admin (Alex) listed too.
//   3. Rollup counts match the seeded shape; the two-team athlete appears in
//      the search index under BOTH teams.
//   4. FIELD ALLOWLIST: the serialized payload contains card info only — no
//      dream, reflections, contact, or guardian data, ever.
//   5. Disclosure flags are passed through from lib/structure VERBATIM.
//   6. The gate is the existing create_team tier (ORG_ADMIN yes, staff no) —
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

  it("staff ordered HC → AC → GM, empty roles absent; players carry board points", async () => {
    const data = await mustangData();
    const varsity = data.programs
      .flatMap((p) => p.divisions)
      .flatMap((d) => d.teams)
      .find((t) => t.name === "Mustang Broncos")!;
    expect(varsity).toBeDefined();

    const roles = varsity.staff.map((s) => s.role);
    // Seed: Gary (HC), Dana (AC), Morgan (GM) on Varsity — exactly this order.
    expect(roles).toEqual(["HEAD_COACH", "ASSISTANT_COACH", "GENERAL_MANAGER"]);

    const jv = data.programs
      .flatMap((p) => p.divisions)
      .flatMap((d) => d.teams)
      .find((t) => t.name === "Mustang JV")!;
    // JV has only a head coach — no AC/GM entries at all.
    expect(jv.staff.map((s) => s.role)).toEqual(["HEAD_COACH"]);

    // Players sorted by membership points desc, and points are the BOARD
    // number (membership cache), not career.
    const pts = varsity.players.map((p) => p.points);
    expect([...pts].sort((a, b) => b - a)).toEqual(pts);
  });

  it("owner = earliest ORG_ADMIN grant (Gary); membership-less admin listed", async () => {
    const data = await mustangData();
    expect(data.owner?.name).toBe("Coach Gary");
    expect(data.admins.map((a) => a.name)).toContain("Alex Vaughn");
  });

  it("rollups match the seeded shape; two-team athlete indexed under both teams", async () => {
    const data = await mustangData();
    expect(data.totals.teamCount).toBe(2); // Varsity + JV
    expect(data.programs).toHaveLength(1);
    expect(data.programs[0].divisionCount).toBe(2);
    const perDivisionPlayers = data.programs[0].divisions.map((d) => d.playerCount);
    expect(data.programs[0].playerCount).toBe(perDivisionPlayers.reduce((a, b) => a + b, 0));

    const caseyEntries = data.searchIndex.filter(
      (e) => e.kind === "player" && e.name === "Casey Rivers",
    );
    expect(caseyEntries).toHaveLength(2); // Varsity AND JV contexts
    expect(new Set(caseyEntries.map((e) => e.path.teamId)).size).toBe(2);

    // Structure nodes are searchable too.
    expect(data.searchIndex.some((e) => e.kind === "division" && e.name === "JV")).toBe(true);
    expect(data.searchIndex.some((e) => e.kind === "team")).toBe(true);
  });

  it("FIELD ALLOWLIST: card info only — no dream/reflection/contact keys anywhere", async () => {
    const data = await mustangData();
    const payload = JSON.stringify(data);
    for (const forbidden of [
      '"dream"', '"reflection"', '"learned"', '"noteToTomorrow"',
      '"guardian', '"phone"', '"email"', '"dob"', '"address',
      '"pointsPerGame"', '"heightInches"',
    ]) {
      expect(payload.includes(forbidden), `payload leaked ${forbidden}`).toBe(false);
    }
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
