import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// THE CEO (owner, 2026-10-09): one account above every organization. Sees
// every org, team, coach and player — NEVER a player's journal or
// reflections. Granted only by scripts/grant-platform-role.ts; an account it
// creates must pick its own password at first login.
//
// Same runner contract: localhost-only, self-skips without TEST_DATABASE_URL.

const url = process.env.TEST_DATABASE_URL;
const host = url ? new URL(url).hostname : null;
if (url && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("TEST_DATABASE_URL must point at localhost — this suite writes.");
}
if (url) process.env.DATABASE_URL = url;

const dbDescribe = url ? describe : describe.skip;

describe("CEO View reads — by construction", () => {
  const src = readFileSync(join(__dirname, "..", "lib", "data", "ceo.ts"), "utf8");
  // Code only — the header comment names what's excluded.
  const code = src.replace(/\/\/.*$/gm, "");

  it("never touches journal, review or takeaway models, and never a bare include", () => {
    expect(code).not.toMatch(/\b(journalEntry|dailyReview|mindsetTakeaway)\b/);
    expect(code).not.toMatch(/\b(journalEntries|dailyReviews|mindsetTakeaways)\b/);
    expect(code).not.toMatch(/\binclude\s*:/);
    expect(code).not.toMatch(/\$(queryRaw|executeRaw)/);
  });

  it("never selects a reflection field", () => {
    for (const field of ["reflection", "learned", "noteToTomorrow", "outcome"]) {
      expect(code).not.toMatch(new RegExp(`\\b${field}\\s*:`));
    }
  });
});

dbDescribe("the CEO", () => {
  afterAll(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });

  it("resolves as CEO: CEO View home, set up, no team, no tabs", async () => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser, actingTeamId } = await import("../lib/context");
    const { personaOf } = await import("../lib/persona");
    const { chromeFor } = await import("../lib/nav");
    const { isSetUp } = await import("../lib/onboarding");
    const ceo = await prisma.user.findUniqueOrThrow({ where: { email: "ceo@elite24.demo" } });
    const ctx = (await resolveContextForUser(ceo.id, null))!;
    expect(ctx.platformRole).toBe("CEO");
    expect(personaOf(ctx)).toBe("ceo");
    expect(isSetUp(ctx)).toBe(true);
    expect(actingTeamId(ctx)).toBeNull();
    const chrome = chromeFor("ceo", { userId: ceo.id, unread: 0, isOrgAdmin: false, ceo: true });
    expect(chrome.tabs).toBeNull();
    expect(chrome.links[0]).toEqual({ href: "/ceo", label: "CEO View" });
  });

  it("nobody else resolves as CEO — or can get a CEO pass for the reads", async () => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser } = await import("../lib/context");
    const { ceoAccessFrom } = await import("../lib/data/ceo");
    for (const email of ["gary@elite24.demo", "alex@elite24.demo", "jordan.carter@example.com", "avery.collins@example.com"]) {
      const u = await prisma.user.findUniqueOrThrow({ where: { email } });
      const ctx = (await resolveContextForUser(u.id, null))!;
      expect(ctx.platformRole).toBeNull();
      expect(ceoAccessFrom(ctx)).toBeNull();
    }
    expect(ceoAccessFrom(null)).toBeNull();
    const ceo = await prisma.user.findUniqueOrThrow({ where: { email: "ceo@elite24.demo" } });
    expect(ceoAccessFrom((await resolveContextForUser(ceo.id, null))!)).not.toBeNull();
  });

  it("sees a whole team and a player's card — and none of their written words", async () => {
    const { prisma } = await import("../lib/prisma");
    const { teamDetail, personDetail, orgDetail, listOrganizations, searchPeople, ceoOverview, ceoAccessFrom } =
      await import("../lib/data/ceo");
    const { resolveContextForUser } = await import("../lib/context");
    const ceoUser = await prisma.user.findUniqueOrThrow({ where: { email: "ceo@elite24.demo" } });
    const ceo = ceoAccessFrom((await resolveContextForUser(ceoUser.id, null))!)!;
    const jordan = await prisma.user.findUniqueOrThrow({
      where: { email: "jordan.carter@example.com" },
      include: { profileRecord: { include: { memberships: true } } },
    });
    const profileId = jordan.profileRecord!.id;
    const teamId = jordan.profileRecord!.memberships[0].teamId;
    const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId } });

    const results = await Promise.all([
      ceoOverview(ceo),
      listOrganizations(ceo),
      orgDetail(ceo, team.organizationId!),
      teamDetail(ceo, teamId),
      searchPeople(ceo, "jordan"),
      personDetail(ceo, profileId),
    ]);
    const person = results[5]!;
    expect(person.name).toBe("Jordan Carter");
    expect(person.thisWeek.checkIns).toBeGreaterThanOrEqual(0);
    expect(results[3]!.players.some((p) => p.profileId === profileId)).toBe(true);

    // Everything Jordan ever wrote — none of it may appear anywhere.
    const words = [
      ...(await prisma.journalEntry.findMany({ where: { userId: jordan.id }, select: { reflection: true } })).map((e) => e.reflection),
      ...(await prisma.dailyReview.findMany({ where: { userId: jordan.id }, select: { learned: true, noteToTomorrow: true } }))
        .flatMap((r) => [r.learned, r.noteToTomorrow]),
      ...(await prisma.mindsetTakeaway.findMany({ where: { userId: jordan.id }, select: { text: true } })).map((t) => t.text),
    ].filter((w): w is string => !!w && w.length > 3);
    expect(words.length).toBeGreaterThan(0);
    const seen = JSON.stringify(results);
    for (const w of words) expect(seen).not.toContain(w);
  });

  it("opening a person is recorded", async () => {
    const { prisma } = await import("../lib/prisma");
    const { recordAudit, listAudit, ceoAccessFrom } = await import("../lib/data/ceo");
    const { resolveContextForUser } = await import("../lib/context");
    const ceoUser = await prisma.user.findUniqueOrThrow({ where: { email: "ceo@elite24.demo" } });
    const ceo = ceoAccessFrom((await resolveContextForUser(ceoUser.id, null))!)!;
    await recordAudit(ceo, "ceo.view_person", { targetProfileId: ceo.profileId, detail: "__audit_probe__" });
    const recent = await listAudit(ceo, 5);
    expect(recent.some((e) => e.detail === "__audit_probe__")).toBe(true);
    await prisma.auditEvent.deleteMany({ where: { detail: "__audit_probe__" } });
  });
});

dbDescribe("grant script + forced password change", () => {
  const EMAIL = "__ceo_grant_test__@example.test";

  afterAll(async () => {
    const { prisma } = await import("../lib/prisma");
    // Clean up and give the seeded CEO back their grant.
    const u = await prisma.user.findUnique({ where: { email: EMAIL }, include: { profileRecord: true } });
    if (u?.profileRecord) {
      await prisma.auditEvent.deleteMany({ where: { actorProfileId: u.profileRecord.id } });
      await prisma.profile.delete({ where: { id: u.profileRecord.id } });
    }
    if (u) await prisma.user.delete({ where: { id: u.id } });
    await prisma.platformGrant.updateMany({
      where: { profile: { user: { email: "ceo@elite24.demo" } } },
      data: { revokedAt: null },
    });
    await prisma.$disconnect();
  });

  it("there is one CEO: a second is refused; the same one is a no-op", async () => {
    const { prisma } = await import("../lib/prisma");
    const { planGrant } = await import("../scripts/grant-platform-role");
    expect((await planGrant(prisma as never, EMAIL, "Test Person")).kind).toBe("refused");
    expect((await planGrant(prisma as never, "ceo@elite24.demo")).kind).toBe("already-ceo");
  });

  it("creates the account with no team, must-change-password, and the CEO grant", async () => {
    const { prisma } = await import("../lib/prisma");
    const { planGrant, applyGrant, revokeGrant } = await import("../scripts/grant-platform-role");
    const { resolveContextForUser } = await import("../lib/context");
    const { personaOf } = await import("../lib/persona");
    await revokeGrant(prisma as never, "ceo@elite24.demo"); // make room for the one CEO

    const plan = await planGrant(prisma as never, EMAIL, "Test Person");
    expect(plan.kind).toBe("create-account");
    expect((await applyGrant(prisma as never, plan, "short")).kind).toBe("refused");
    await applyGrant(prisma as never, plan, "starting-pass-123");

    const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(user.teamId).toBeNull();
    expect(user.mustChangePassword).toBe(true);
    const ctx = (await resolveContextForUser(user.id, null))!;
    expect(personaOf(ctx)).toBe("ceo");
  });

  it("the new owner must pick a different password; then the flag clears", async () => {
    const { prisma } = await import("../lib/prisma");
    const { changeOwnPassword } = await import("../lib/account");
    const { verifyPassword } = await import("../lib/password");
    const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });

    expect(await changeOwnPassword(user.id, { current: "wrong-pass-1", next: "brand-new-pass", confirm: "brand-new-pass" }))
      .toEqual({ error: expect.stringMatching(/current password/) });
    expect(await changeOwnPassword(user.id, { current: "starting-pass-123", next: "starting-pass-123", confirm: "starting-pass-123" }))
      .toEqual({ error: expect.stringMatching(/different/) });
    expect(await changeOwnPassword(user.id, { current: "starting-pass-123", next: "brand-new-pass", confirm: "brand-new-pas" }))
      .toEqual({ error: expect.stringMatching(/match/) });
    expect(await changeOwnPassword(user.id, { current: "starting-pass-123", next: "brand-new-pass", confirm: "brand-new-pass" }))
      .toEqual({ ok: true });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.mustChangePassword).toBe(false);
    expect(await verifyPassword("brand-new-pass", after.passwordHash!)).toBe(true);
  });
});
