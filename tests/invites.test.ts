import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { codeKind, inviteState, newCode, normalizeCode } from "../lib/invites";

// INVITES + ORG CODES (person-first plan Phase 3, owner 2026-10-09): a code is
// the only way onto a team or into running an organization.
//   1. Codes by shape: team 6, staff 8, org ORG+8; typed loosely, read strictly.
//   2. Only keyed hashes are stored; the code and link find the same invite.
//   3. Accepting is single use — even two people at the same instant.
//   4. Expired / cancelled invites are refused; an org-admin invite grants
//      ORG_ADMIN; a staff invite makes a staff membership.
//   5. Starting an organization with an org code builds it all in one go
//      (season, groups, team, quests ON, admin, head coach) and uses the code.
//
// DB part: localhost-only, self-skips without TEST_DATABASE_URL.

describe("codes", () => {
  it("normalize loosely, classify by shape", () => {
    expect(normalizeCode(" k7qd-m2px ")).toBe("K7QDM2PX");
    expect(codeKind("MUSTJV")).toBe("team");
    expect(codeKind("K7QDM2PX")).toBe("staff");
    expect(codeKind("ORGW3TX9KQP")).toBe("org");
    expect(codeKind("ABC")).toBeNull();
    const staff = newCode("STAFF");
    expect(staff.display).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(codeKind(staff.normalized)).toBe("staff");
    const org = newCode("ORG_CREATE");
    expect(org.display).toMatch(/^ORG-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(codeKind(org.normalized)).toBe("org");
  });

  it("state: revoked beats used beats expired", () => {
    const past = new Date(Date.now() - 1000);
    const future = new Date(Date.now() + 86_400_000);
    expect(inviteState({ usedAt: null, revokedAt: null, expiresAt: future })).toBe("open");
    expect(inviteState({ usedAt: null, revokedAt: null, expiresAt: past })).toBe("expired");
    expect(inviteState({ usedAt: past, revokedAt: null, expiresAt: future })).toBe("used");
    expect(inviteState({ usedAt: past, revokedAt: past, expiresAt: future })).toBe("revoked");
  });
});

const url = process.env.TEST_DATABASE_URL;
const host = url ? new URL(url).hostname : null;
if (url && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("TEST_DATABASE_URL must point at localhost — this suite writes.");
}
if (url) process.env.DATABASE_URL = url;
const dbDescribe = url ? describe : describe.skip;

dbDescribe("invites + starting an organization", () => {
  const w = {} as { orgId: number; teamId: number; seasonId: number; people: { profileId: number; userId: number }[]; createdOrgs: number[] };

  beforeAll(async () => {
    const { prisma } = await import("../lib/prisma");
    const org = await prisma.organization.create({ data: { name: "__inv_org__" } });
    const season = await prisma.season.create({ data: { organizationId: org.id, name: "2026", isCurrent: true } });
    const team = await prisma.team.create({ data: { name: "__inv_team__", organizationId: org.id } });
    const people = [];
    for (const n of ["a", "b", "c", "d"]) {
      const user = await prisma.user.create({ data: { name: `__inv_${n}__`, email: `__inv_${n}__@example.test` } });
      const profile = await prisma.profile.create({ data: { userId: user.id, name: `__inv_${n}__` } });
      people.push({ profileId: profile.id, userId: user.id });
    }
    Object.assign(w, { orgId: org.id, teamId: team.id, seasonId: season.id, people, createdOrgs: [] });
  });

  afterAll(async () => {
    const { prisma } = await import("../lib/prisma");
    const orgs = [w.orgId, ...w.createdOrgs];
    const profileIds = w.people.map((p) => p.profileId);
    await prisma.invite.deleteMany({ where: { OR: [{ organizationId: { in: orgs } }, { createdByProfileId: { in: profileIds } }] } });
    await prisma.auditEvent.deleteMany({ where: { OR: [{ organizationId: { in: orgs } }, { actorProfileId: { in: profileIds } }] } });
    await prisma.membership.deleteMany({ where: { team: { organizationId: { in: orgs } } } });
    await prisma.roleAssignment.deleteMany({ where: { organizationId: { in: orgs } } });
    await prisma.quest.deleteMany({ where: { organizationId: { in: orgs } } });
    await prisma.team.deleteMany({ where: { organizationId: { in: orgs } } });
    for (const d of [4, 3, 2, 1]) await prisma.group.deleteMany({ where: { organizationId: { in: orgs }, depth: d } });
    await prisma.season.deleteMany({ where: { organizationId: { in: orgs } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgs } } });
    await prisma.profile.deleteMany({ where: { id: { in: profileIds } } });
    await prisma.user.deleteMany({ where: { id: { in: w.people.map((p) => p.userId) } } });
    await prisma.$disconnect();
  });

  it("stores only keyed hashes; code and link find the same invite", async () => {
    const { prisma } = await import("../lib/prisma");
    const { createInvite, findInviteByCode, findInviteByToken } = await import("../lib/invites");
    const made = await createInvite({ kind: "STAFF", role: "ASSISTANT_COACH", organizationId: w.orgId, teamId: w.teamId, createdByProfileId: w.people[0].profileId });
    const row = await prisma.invite.findUniqueOrThrow({ where: { id: made.invite.id } });
    expect(JSON.stringify(row)).not.toContain(normalizeCode(made.code));
    expect(JSON.stringify(row)).not.toContain(made.token);
    expect((await findInviteByCode(normalizeCode(made.code)))?.id).toBe(made.invite.id);
    expect((await findInviteByToken(made.token))?.id).toBe(made.invite.id);
    expect(await findInviteByToken("nope")).toBeNull();
  });

  it("a staff invite makes staff on its team — once, even when two accept at the same instant", async () => {
    const { prisma } = await import("../lib/prisma");
    const { createInvite, acceptStaffInvite } = await import("../lib/invites");
    const { invite } = await createInvite({ kind: "STAFF", role: "ASSISTANT_COACH", organizationId: w.orgId, teamId: w.teamId, createdByProfileId: w.people[0].profileId });
    const results = await Promise.all([acceptStaffInvite(invite, w.people[1]), acceptStaffInvite(invite, w.people[2])]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const winner = results[0].ok ? w.people[1] : w.people[2];
    const m = await prisma.membership.findFirstOrThrow({ where: { profileId: winner.profileId, teamId: w.teamId } });
    expect(m.role).toBe("ASSISTANT_COACH");
    // What they see follows the membership: staff, on that team.
    const { resolveContextForUser } = await import("../lib/context");
    const { personaOf } = await import("../lib/persona");
    expect(personaOf((await resolveContextForUser(winner.userId, null))!)).toBe("staff");
    const used = await prisma.invite.findUniqueOrThrow({ where: { id: invite.id } });
    expect(used.usedByProfileId).toBe(winner.profileId);
  });

  it("expired and cancelled invites are refused; an org-admin invite grants ORG_ADMIN", async () => {
    const { prisma } = await import("../lib/prisma");
    const { createInvite, acceptStaffInvite } = await import("../lib/invites");
    const expired = await createInvite({ kind: "STAFF", role: "GENERAL_MANAGER", organizationId: w.orgId, teamId: w.teamId, createdByProfileId: w.people[0].profileId });
    const e = await prisma.invite.update({ where: { id: expired.invite.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await acceptStaffInvite(e, w.people[3])).toMatchObject({ ok: false });
    const cancelled = await createInvite({ kind: "STAFF", role: "GENERAL_MANAGER", organizationId: w.orgId, teamId: w.teamId, createdByProfileId: w.people[0].profileId });
    const c = await prisma.invite.update({ where: { id: cancelled.invite.id }, data: { revokedAt: new Date() } });
    expect(await acceptStaffInvite(c, w.people[3])).toMatchObject({ ok: false });

    const admin = await createInvite({ kind: "STAFF", role: "ORG_ADMIN", organizationId: w.orgId, createdByProfileId: w.people[0].profileId });
    expect(await acceptStaffInvite(admin.invite, w.people[3])).toMatchObject({ ok: true, teamId: null });
    expect(await prisma.roleAssignment.count({ where: { profileId: w.people[3].profileId, role: "ORG_ADMIN", organizationId: w.orgId, revokedAt: null } })).toBe(1);
  });

  it("an org code starts one organization, fully built; the code can't be used twice", async () => {
    const { prisma } = await import("../lib/prisma");
    const { createInvite } = await import("../lib/invites");
    const { createOrganization } = await import("../lib/data/create-org");
    const { templateGroups } = await import("../lib/structure-templates");
    const shape = templateGroups({ template: "club", genders: ["Boys", "Girls"], ages: [14, 15] });
    if (!shape.ok) throw new Error(shape.error);
    const code = await createInvite({ kind: "ORG_CREATE", label: "__inv_new_org__", createdByProfileId: w.people[0].profileId });
    const creator = w.people[0];
    const made = await createOrganization({
      name: "__inv_new_org__",
      groups: shape.groups,
      team: { name: "__inv_new_team__", place: "1.0" }, // Girls · 14U
      creator,
      orgCodeId: code.invite.id,
      becomeAdmin: true,
      coachTeam: true,
    });
    if (!made.ok) throw new Error(made.error);
    w.createdOrgs.push(made.orgId);

    const [groups, team, quests, admin, coach, season, usedCode] = await Promise.all([
      prisma.group.findMany({ where: { organizationId: made.orgId } }),
      prisma.team.findUniqueOrThrow({ where: { id: made.teamId! }, include: { group: { include: { parent: true } } } }),
      prisma.quest.findMany({ where: { organizationId: made.orgId } }),
      prisma.roleAssignment.count({ where: { profileId: creator.profileId, role: "ORG_ADMIN", organizationId: made.orgId } }),
      prisma.membership.findFirst({ where: { profileId: creator.profileId, teamId: made.teamId! } }),
      prisma.season.findFirst({ where: { organizationId: made.orgId, isCurrent: true } }),
      prisma.invite.findUniqueOrThrow({ where: { id: code.invite.id } }),
    ]);
    expect(groups).toHaveLength(6); // Boys, Girls × 14U, 15U
    expect(`${team.group?.parent?.name} · ${team.group?.name}`).toBe("Girls · 14U");
    expect(team.joinCode).toMatch(/^[A-Z2-9]{6}$/);
    expect(quests.length).toBeGreaterThan(0);
    expect(quests.every((q) => q.active)).toBe(true);
    expect(admin).toBe(1);
    expect(coach?.role).toBe("HEAD_COACH");
    expect(season).not.toBeNull();
    expect(usedCode.usedByProfileId).toBe(creator.profileId);
    expect(usedCode.organizationId).toBe(made.orgId);

    const again = await createOrganization({
      name: "__inv_twice__", groups: [], team: null, creator: w.people[1], orgCodeId: code.invite.id, becomeAdmin: true, coachTeam: false,
    });
    expect(again.ok).toBe(false);
    expect(await prisma.organization.count({ where: { name: "__inv_twice__" } })).toBe(0); // nothing half-made
  });
});
