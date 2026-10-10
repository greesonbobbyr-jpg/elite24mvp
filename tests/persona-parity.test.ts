import { afterAll, describe, expect, it } from "vitest";

// PROVES the person-first switch (Phase 1) changed nothing for anyone on a
// team: for EVERY seeded user, what they see — the ☰ menu, the bottom tabs,
// which home (and which team on it), whether a TIME OUT can cover the screen,
// and the setup gate — is decided by persona now, and must equal what the
// fixed login role decided before (the legacy logic is frozen below, copied
// from app/(main)/layout.tsx + page.tsx at 66bb147).
//
// The ONLY people allowed to differ are those with no team at all:
//   devon  removed from Varsity — no longer stuck behind its TIME OUT, no
//          team menu (the bug this phase fixes)
//   avery  Personal Player Development — the no-team player loop
//   ceo    the CEO — CEO View is home
//
// Same runner contract: localhost-only, self-skips without TEST_DATABASE_URL.

const url = process.env.TEST_DATABASE_URL;
const host = url ? new URL(url).hostname : null;
if (url && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("TEST_DATABASE_URL must point at localhost — this suite writes.");
}
if (url) process.env.DATABASE_URL = url;

const dbDescribe = url ? describe : describe.skip;

type Ctx = NonNullable<Awaited<ReturnType<typeof import("../lib/context").resolveContextForUser>>>;

// ---- The pre-persona decisions, frozen ------------------------------------
function legacyChrome(ctx: Ctx) {
  const user = ctx.user;
  if (user.role === "PLAYER") {
    return {
      tabs: "player",
      links: [
        { href: `/brand/${user.id}`, label: "Your Brand" },
        { href: "/journal", label: "Journal" },
        { href: "/leaderboard", label: "Leaderboard" },
        { href: "/notifications", label: "Notifications" },
        { href: "/library", label: "Playbook" },
      ],
    };
  }
  if (user.role === "COACH") {
    // Two intended changes since 66bb147 (Phase 2, owner 2026-10-09): the
    // item is "Organization View", and group admins get it too.
    const isOrgAdmin = ctx.profile ? ctx.orgAdminOf.length + ctx.groupAdminOf.length > 0 : true;
    return {
      tabs: "coach",
      links: [
        { href: "/team", label: "Team settings" },
        ...(isOrgAdmin ? [{ href: "/org", label: "Organization View" }] : []),
        { href: "/leaderboard", label: "Team leaderboard" },
        { href: "/library", label: "Playbook" },
      ],
    };
  }
  return { tabs: null, links: [] };
}

// Home: staff got CoachHome on the legacy anchor; players the player home.
function legacyHome(ctx: Ctx) {
  return ctx.user.role === "COACH" ? { kind: "coach", teamId: ctx.user.teamId } : { kind: "player" };
}

// TIME OUT could cover the screen of any PLAYER-role login with a team id.
function legacyTimeoutTeam(ctx: Ctx) {
  return ctx.user.role === "PLAYER" ? (ctx.membership?.teamId ?? ctx.user.teamId) : null;
}

function legacySetUp(ctx: Ctx) {
  if (ctx.user.role !== "PLAYER") return true;
  if (ctx.profile) return ctx.profile.setupCompletedAt != null;
  return Boolean(ctx.user.profile?.onboardedAt);
}

dbDescribe("persona parity — every seeded user sees what they saw before", () => {
  afterAll(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });

  it("menu, tabs, home, TIME OUT and setup match the old role logic — except the no-team people", async () => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser, actingTeamId } = await import("../lib/context");
    const { personaOf, isStaffSide } = await import("../lib/persona");
    const { chromeFor } = await import("../lib/nav");
    const { isSetUp } = await import("../lib/onboarding");

    const users = await prisma.user.findMany({ select: { id: true, email: true }, orderBy: { id: "asc" } });
    expect(users.length).toBeGreaterThan(100);

    const changed: string[] = [];
    for (const { id, email } of users) {
      const ctx = (await resolveContextForUser(id, null))!;
      const persona = personaOf(ctx);
      const isOrgAdmin = ctx.profile ? ctx.orgAdminOf.length + ctx.groupAdminOf.length > 0 : true;
      const chrome = chromeFor(persona, { userId: id, unread: 0, isOrgAdmin });
      const teamId = actingTeamId(ctx);
      const home = isStaffSide(persona) ? { kind: "coach", teamId } : { kind: "player" };
      const timeoutTeam = persona === "athlete" ? teamId : null;

      // The setup gate never changes, for anyone.
      expect(isSetUp(ctx), `${email}: setup gate`).toBe(legacySetUp(ctx));

      if (persona === "personal" || persona === "new" || persona === "ceo") {
        changed.push(email ?? String(id));
        continue;
      }
      expect(chrome, `${email}: menu + tabs`).toEqual(legacyChrome(ctx));
      expect(home, `${email}: home`).toEqual(legacyHome(ctx));
      expect(timeoutTeam, `${email}: TIME OUT team`).toBe(legacyTimeoutTeam(ctx));
    }

    // Exactly the two intended no-team people, nobody else.
    expect(changed.sort()).toEqual(["avery.collins@example.com", "ceo@elite24.demo", "devon.price@example.com"]);
  });

  it("the removed player: personal, no team, so no TIME OUT and no team menu", async () => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser, actingTeamId } = await import("../lib/context");
    const { personaOf } = await import("../lib/persona");
    const { getActiveTimeout } = await import("../lib/notifications");

    const devon = await prisma.user.findUniqueOrThrow({ where: { email: "devon.price@example.com" } });
    const ctx = (await resolveContextForUser(devon.id, null))!;
    expect(personaOf(ctx)).toBe("personal");
    expect(actingTeamId(ctx)).toBeNull();
    // The bug, for the record: the old anchor team DOES have a TIME OUT they
    // never acknowledged — and could not, once removed.
    expect(devon.teamId).not.toBeNull();
    expect(await getActiveTimeout(devon.id, devon.teamId!, null)).not.toBeNull();
  });

  it("the personal athlete: no team anywhere, the Elite24 quest set, career points from quests", async () => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser } = await import("../lib/context");
    const { personaOf } = await import("../lib/persona");
    const { listActiveQuestsForOrg } = await import("../lib/quests");

    const avery = await prisma.user.findUniqueOrThrow({
      where: { email: "avery.collins@example.com" },
      include: { profileRecord: true },
    });
    expect(avery.teamId).toBeNull();
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
    expect(avery.profileRecord?.careerPoints).toBe(all._sum.amount);
  });
});
