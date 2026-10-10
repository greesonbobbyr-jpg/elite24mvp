import { afterAll, describe, expect, it } from "vitest";

// THE SESSION CONTEXT on the seeded world: every login resolves to its own
// login row and its person; what someone is comes from their memberships and
// grants (there is no role or team on the login); a login with no person
// does not resolve.
//
// Same runner contract: localhost-only, self-skips without TEST_DATABASE_URL.

const url = process.env.TEST_DATABASE_URL;
const host = url ? new URL(url).hostname : null;
if (url && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("TEST_DATABASE_URL must point at localhost — this suite writes.");
}
if (url) process.env.DATABASE_URL = url;

const dbDescribe = url ? describe : describe.skip;

dbDescribe("session context", () => {
  afterAll(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });

  it("every seeded login resolves: its own row, its own person, a persona and its menu", async () => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser, actingTeamId } = await import("../lib/context");
    const { personaOf } = await import("../lib/persona");
    const { chromeFor } = await import("../lib/nav");

    const users = await prisma.user.findMany({ orderBy: { id: "asc" } });
    expect(users.length).toBeGreaterThan(100);
    const seen: Record<string, number> = {};
    for (const user of users) {
      const ctx = await resolveContextForUser(user.id, null);
      expect(ctx, user.email ?? String(user.id)).not.toBeNull();
      expect(ctx!.user).toStrictEqual(user);
      expect(ctx!.profile.userId).toBe(user.id);
      const persona = personaOf(ctx!);
      seen[persona] = (seen[persona] ?? 0) + 1;
      // A team exactly when there is an acting membership.
      expect(actingTeamId(ctx!) != null).toBe(persona === "athlete" || persona === "staff");
      const isOrgAdmin = ctx!.orgAdminOf.length + ctx!.groupAdminOf.length > 0;
      const chrome = chromeFor(persona, { userId: user.id, unread: 0, isOrgAdmin, ceo: ctx!.platformRole === "CEO" });
      expect(chrome.links.some((l) => l.href === "/org")).toBe(isOrgAdmin && (persona === "staff" || persona === "admin"));
      expect(chrome.tabs).toBe(
        persona === "athlete" ? "player" : persona === "personal" ? "player-solo" : persona === "staff" || persona === "admin" ? "coach" : null,
      );
    }
    // The seed has every kind of person.
    for (const persona of ["athlete", "staff", "admin", "ceo", "personal", "new"]) {
      expect(seen[persona] ?? 0, persona).toBeGreaterThan(0);
    }
  });

  it("a head coach who is also an org admin, and a player", async () => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser } = await import("../lib/context");

    const gary = await prisma.user.findUniqueOrThrow({ where: { email: "gary@elite24.demo" } });
    const ctx = (await resolveContextForUser(gary.id))!;
    expect(ctx.membership?.role).toBe("HEAD_COACH");
    expect(ctx.team?.organizationId).not.toBeNull();
    expect(ctx.orgAdminOf).toContain(ctx.team!.organizationId!);
    expect(ctx.season?.isCurrent).toBe(true);

    const jordan = await prisma.user.findUniqueOrThrow({ where: { email: "jordan.carter@example.com" } });
    const pctx = (await resolveContextForUser(jordan.id))!;
    expect(pctx.membership?.role).toBe("PLAYER");
    expect(pctx.orgAdminOf).toEqual([]);
    expect(pctx.platformRole).toBeNull();
  });

  it("an org admin with no roster spot has no team: Organization View is where they work", async () => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser, actingTeamId, actingScope } = await import("../lib/context");
    const { personaOf } = await import("../lib/persona");

    const alex = await prisma.user.findUniqueOrThrow({ where: { email: "alex@elite24.demo" } });
    const ctx = (await resolveContextForUser(alex.id))!;
    expect(personaOf(ctx)).toBe("admin");
    expect(ctx.memberships).toEqual([]);
    expect(actingTeamId(ctx)).toBeNull();
    expect(actingScope(ctx)).toBeNull();
    expect(ctx.orgAdminOf).toHaveLength(1);
  });

  it("the removed player: personal, no team, so no TIME OUT and no team menu", async () => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser, actingTeamId } = await import("../lib/context");
    const { personaOf } = await import("../lib/persona");
    const { getActiveTimeout } = await import("../lib/notifications");

    const devon = await prisma.user.findUniqueOrThrow({
      where: { email: "devon.price@example.com" },
      include: { profile: { include: { memberships: true } } },
    });
    const ctx = (await resolveContextForUser(devon.id, null))!;
    expect(personaOf(ctx)).toBe("personal");
    expect(actingTeamId(ctx)).toBeNull();
    // For the record: the team they were removed from DOES have a TIME OUT
    // they never acknowledged — it must never reach them again.
    const oldTeamId = devon.profile!.memberships.find((m) => m.endedAt != null)!.teamId;
    expect(await getActiveTimeout(devon.id, oldTeamId, null)).not.toBeNull();
  });

  it("the personal athlete: no team anywhere, the Elite24 quest set, career points from quests", async () => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser } = await import("../lib/context");
    const { personaOf } = await import("../lib/persona");
    const { listActiveQuestsForOrg } = await import("../lib/quests");

    const avery = await prisma.user.findUniqueOrThrow({ where: { email: "avery.collins@example.com" } });
    const ctx = (await resolveContextForUser(avery.id, null))!;
    expect(personaOf(ctx)).toBe("personal");
    expect(ctx.memberships).toEqual([]);

    const served = await listActiveQuestsForOrg(ctx.org?.id);
    expect(served.length).toBeGreaterThan(0);
    expect(served.every((q) => q.organizationId == null)).toBe(true);

    const questPoints = await prisma.pointsLedger.aggregate({
      where: { userId: avery.id, source: "QUEST" },
      _sum: { amount: true },
    });
    expect(questPoints._sum.amount ?? 0).toBeGreaterThan(0);
    const all = await prisma.pointsLedger.aggregate({ where: { userId: avery.id }, _sum: { amount: true } });
    expect(ctx.profile.careerPoints).toBe(all._sum.amount);
  });

  it("a team player is served their own organization's quests — never another org's or the shared set", async () => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser } = await import("../lib/context");
    const { listActiveQuestsForOrg } = await import("../lib/quests");

    const jordan = await prisma.user.findUniqueOrThrow({ where: { email: "jordan.carter@example.com" } });
    const ctx = (await resolveContextForUser(jordan.id, null))!;
    const served = await listActiveQuestsForOrg(ctx.org?.id);
    expect(served.length).toBeGreaterThan(0);
    expect(served.every((q) => q.organizationId === ctx.org!.id)).toBe(true);
  });

  it("a login with no person does not resolve (it can't act)", async () => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser } = await import("../lib/context");
    const bare = await prisma.user.create({ data: { name: "__ctx_bare__" } });
    try {
      expect(await resolveContextForUser(bare.id)).toBeNull();
    } finally {
      await prisma.user.delete({ where: { id: bare.id } });
    }
  });
});
