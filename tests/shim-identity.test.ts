import { afterAll, describe, expect, it } from "vitest";

// PROVES the Stage 2 compat shim is byte-for-byte identical to the legacy
// getCurrentUser(): for EVERY user in the database, the row the shim returns
// (ctx.user out of resolveContextForUser) deep-equals the row the legacy query
// returned — same query, same object, nothing reconstructed.
//
// Also covers the transition edge: a login created by the LEGACY signup path
// after the backfill ran (no Profile yet) must still resolve — legacy row
// intact, new-world fields empty.
//
// Same runner contract as season-invariant.test.ts: localhost-only, self-skips
// without TEST_DATABASE_URL.

const url = process.env.TEST_DATABASE_URL;
const host = url ? new URL(url).hostname : null;
if (url && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("TEST_DATABASE_URL must point at localhost — this suite writes.");
}
if (url) process.env.DATABASE_URL = url;

const dbDescribe = url ? describe : describe.skip;

dbDescribe("compat shim identity", () => {
  afterAll(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });

  it("ctx.user === legacy getCurrentUser row for EVERY user in the DB", async () => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser } = await import("../lib/context");

    const users = await prisma.user.findMany({ select: { id: true } });
    expect(users.length).toBeGreaterThan(0);

    for (const { id } of users) {
      // The exact query lib/session.getCurrentUser has always run.
      const legacy = await prisma.user.findUnique({
        where: { id },
        include: { team: true, profile: true },
      });
      const ctx = await resolveContextForUser(id);
      expect(ctx).not.toBeNull();
      expect(ctx!.user).toStrictEqual(legacy!);
    }
  });

  it("new-world context is coherent for backfilled users (coach → HEAD_COACH + ORG_ADMIN)", async () => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser } = await import("../lib/context");

    // A coach who is HC + ORG_ADMIN (seed v2 also has AC/GM/org-admin staff).
    const coach = await prisma.user.findFirst({
      where: {
        role: "COACH",
        profileRecord: {
          roleAssignments: { some: { role: "ORG_ADMIN", revokedAt: null } },
          memberships: { some: { role: "HEAD_COACH", endedAt: null } },
        },
      },
    });
    expect(coach).not.toBeNull();
    const ctx = await resolveContextForUser(coach!.id);
    expect(ctx!.profile).not.toBeNull();
    expect(ctx!.membership?.role).toBe("HEAD_COACH");
    expect(ctx!.membership?.teamId).toBe(coach!.teamId);
    expect(ctx!.team?.organizationId).not.toBeNull();
    expect(ctx!.orgAdminOf).toContain(ctx!.team!.organizationId!);
    expect(ctx!.season?.isCurrent).toBe(true);

    // The first seeded player (Jordan) — unordered, Postgres may hand back
    // the removed player instead.
    const player = await prisma.user.findFirst({ where: { role: "PLAYER" }, orderBy: { id: "asc" } });
    const pctx = await resolveContextForUser(player!.id);
    expect(pctx!.membership?.role).toBe("PLAYER");
    expect(pctx!.orgAdminOf).toEqual([]);
  });

  it("a legacy-only login (created after the backfill, no Profile) still resolves", async () => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser } = await import("../lib/context");

    const team = await prisma.team.findFirstOrThrow();
    const orphan = await prisma.user.create({
      data: { name: "__test_legacy_only__", role: "PLAYER", teamId: team.id },
    });
    try {
      const legacy = await prisma.user.findUnique({
        where: { id: orphan.id },
        include: { team: true, profile: true },
      });
      const ctx = await resolveContextForUser(orphan.id);
      expect(ctx!.user).toStrictEqual(legacy!);
      expect(ctx!.profile).toBeNull();
      expect(ctx!.memberships).toEqual([]);
      expect(ctx!.membership).toBeNull();
      expect(ctx!.org).toBeNull();
      expect(ctx!.orgAdminOf).toEqual([]);
    } finally {
      await prisma.user.delete({ where: { id: orphan.id } });
    }
  });
});
