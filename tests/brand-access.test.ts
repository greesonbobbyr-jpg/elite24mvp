import { afterAll, describe, expect, it } from "vitest";

// STAGE 4b ACCESS PROOF, against real backfilled data: the brand/photo access
// resolver must grant org staff (both directions of the owner's worry):
//   - an org staffer CAN view a player in their org        (no naive tightening)
//   - another org's coach CANNOT view across orgs          (no naive loosening)
// plus: self, teammate (card-info tier), org-admin-without-membership, and the
// legacy fallback for a viewer with no Profile yet.
//
// Same runner contract: localhost-only, self-skips without TEST_DATABASE_URL.

const url = process.env.TEST_DATABASE_URL;
const host = url ? new URL(url).hostname : null;
if (url && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("TEST_DATABASE_URL must point at localhost — this suite writes.");
}
if (url) process.env.DATABASE_URL = url;

const dbDescribe = url ? describe : describe.skip;

dbDescribe("Stage 4b brand/photo access", () => {
  afterAll(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });

  // Seeded world: two teams from DIFFERENT orgs (seed v2's Mustang org has
  // two teams — cross-ORG denial must be tested across orgs, not teams).
  async function world() {
    const { prisma } = await import("../lib/prisma");
    const all = await prisma.team.findMany({
      where: { organizationId: { not: null } },
      orderBy: { id: "asc" },
    });
    const teamA = all[0];
    const teamB = all.find((t) => t.organizationId !== teamA.organizationId)!;
    expect(teamB).toBeDefined();
    // People by their ACTIVE membership on a team (the roster truth).
    const on = (teamId: number, role: "HEAD_COACH" | "PLAYER") => ({
      profile: { memberships: { some: { teamId, role, endedAt: null } } },
    });
    const coachA = await prisma.user.findFirstOrThrow({ where: on(teamA.id, "HEAD_COACH"), orderBy: { id: "asc" } });
    const coachB = await prisma.user.findFirstOrThrow({ where: on(teamB.id, "HEAD_COACH"), orderBy: { id: "asc" } });
    const playersA = await prisma.user.findMany({ where: on(teamA.id, "PLAYER"), orderBy: { id: "asc" }, take: 2 });
    const playerB = await prisma.user.findFirstOrThrow({ where: on(teamB.id, "PLAYER"), orderBy: { id: "asc" } });
    expect(playersA.length).toBe(2);
    return { teamA, teamB, coachA, coachB, playerA1: playersA[0], playerA2: playersA[1], playerB };
  }

  async function accessOf(viewerId: number, targetId: number) {
    const { resolveContextForUser } = await import("../lib/context");
    const { resolveBrandAccess } = await import("../lib/brand-access");
    const ctx = await resolveContextForUser(viewerId);
    expect(ctx).not.toBeNull();
    const resolved = await resolveBrandAccess(ctx!, targetId);
    return resolved?.access ?? null;
  }

  it("self → full access", async () => {
    const w = await world();
    expect(await accessOf(w.playerA1.id, w.playerA1.id)).toBe("self");
  });

  it("teammate (player, same team) → card-info tier", async () => {
    const w = await world();
    expect(await accessOf(w.playerA1.id, w.playerA2.id)).toBe("teammate");
  });

  it("org staff CAN view a player in their org", async () => {
    const w = await world();
    expect(await accessOf(w.coachA.id, w.playerA1.id)).toBe("staff");
  });

  it("another org's coach CANNOT view — cross-org is always refused", async () => {
    const w = await world();
    expect(await accessOf(w.coachB.id, w.playerA1.id)).toBe(null);
    expect(await accessOf(w.coachA.id, w.playerB.id)).toBe(null);
  });

  it("a player never sees across orgs (or teams) either", async () => {
    const w = await world();
    expect(await accessOf(w.playerB.id, w.playerA1.id)).toBe(null);
  });

  it("an ORG_ADMIN with no membership is staff org-wide, and nothing cross-org", async () => {
    const { prisma } = await import("../lib/prisma");
    const w = await world();
    const user = await prisma.user.create({ data: { name: "__ba_orgadmin__" } });
    const profile = await prisma.profile.create({
      data: { userId: user.id, name: user.name },
    });
    await prisma.roleAssignment.create({
      data: { profileId: profile.id, role: "ORG_ADMIN", organizationId: w.teamA.organizationId! },
    });
    try {
      expect(await accessOf(user.id, w.playerA1.id)).toBe("staff");
      expect(await accessOf(user.id, w.playerB.id)).toBe(null);
    } finally {
      await prisma.roleAssignment.deleteMany({ where: { profileId: profile.id } });
      await prisma.user.delete({ where: { id: user.id } }); // profile userId → null
      await prisma.profile.delete({ where: { id: profile.id } });
    }
  });

  it("a login with no Profile has no context at all — nothing to fall back on", async () => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser } = await import("../lib/context");
    const bare = await prisma.user.create({ data: { name: "__ba_bare__" } });
    try {
      expect(await resolveContextForUser(bare.id)).toBeNull();
    } finally {
      await prisma.user.delete({ where: { id: bare.id } });
    }
  });

  it("a removed player is no longer visible to their old team; their own page still is", async () => {
    const { prisma } = await import("../lib/prisma");
    const w = await world();
    const devon = await prisma.user.findUniqueOrThrow({ where: { email: "devon.price@example.com" } });
    expect(await accessOf(w.coachA.id, devon.id)).toBe(null);
    expect(await accessOf(w.playerA1.id, devon.id)).toBe(null);
    expect(await accessOf(devon.id, devon.id)).toBe("self");
  });

  it("an org's admin with no roster spot: card info to that org's people only", async () => {
    const { prisma } = await import("../lib/prisma");
    const w = await world();
    const alex = await prisma.user.findUniqueOrThrow({ where: { email: "alex@elite24.demo" } });
    expect(await accessOf(w.playerA1.id, alex.id)).toBe("teammate");
    expect(await accessOf(w.coachA.id, alex.id)).toBe("teammate");
    expect(await accessOf(w.playerB.id, alex.id)).toBe(null);
    expect(await accessOf(w.coachB.id, alex.id)).toBe(null);
  });

  it("staff alongside someone get card info only — never the full view of a player they don't coach", async () => {
    const { prisma } = await import("../lib/prisma");
    const w = await world();
    // Dana is an assistant coach on team A's staff with Coach A; she plays nowhere.
    const dana = await prisma.user.findUniqueOrThrow({ where: { email: "dana@elite24.demo" } });
    expect(await accessOf(w.coachA.id, dana.id)).toBe("teammate"); // her avatar loads; nothing more
    expect(await accessOf(w.playerA1.id, dana.id)).toBe("teammate");
    expect(await accessOf(w.playerB.id, dana.id)).toBe(null);
  });

  it("the page shows the team the access came through (a two-team athlete)", async () => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser } = await import("../lib/context");
    const { resolveBrandAccess } = await import("../lib/brand-access");
    const casey = await prisma.user.findUniqueOrThrow({ where: { email: "casey.rivers@example.com" } });
    const jamie = await prisma.user.findUniqueOrThrow({ where: { email: "jamie@elite24.demo" } }); // JV head coach
    const viaJv = await resolveBrandAccess((await resolveContextForUser(jamie.id))!, casey.id);
    expect(viaJv?.access).toBe("staff");
    expect(viaJv?.team?.joinCode).toBe("MUSTJV");
  });
});
