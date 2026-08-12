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
    const coachA = await prisma.user.findFirstOrThrow({
      where: { teamId: teamA.id, role: "COACH" },
    });
    const coachB = await prisma.user.findFirstOrThrow({
      where: { teamId: teamB.id, role: "COACH" },
    });
    const playersA = await prisma.user.findMany({
      where: { teamId: teamA.id, role: "PLAYER", profile: { isNot: null } },
      take: 2,
    });
    const playerB = await prisma.user.findFirstOrThrow({
      where: { teamId: teamB.id, role: "PLAYER" },
    });
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
    const user = await prisma.user.create({
      data: { name: "__ba_orgadmin__", role: "COACH", teamId: w.teamA.id },
    });
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

  it("legacy fallback: a viewer with no Profile keeps exactly the old same-team scope", async () => {
    const { prisma } = await import("../lib/prisma");
    const w = await world();
    const legacyOnly = await prisma.user.create({
      data: { name: "__ba_legacy__", role: "PLAYER", teamId: w.teamA.id },
    });
    try {
      expect(await accessOf(legacyOnly.id, w.playerA1.id)).toBe("teammate");
      expect(await accessOf(legacyOnly.id, w.playerB.id)).toBe(null); // never wider
    } finally {
      await prisma.user.delete({ where: { id: legacyOnly.id } });
    }
  });
});
