import { afterAll, beforeAll, describe, expect, it } from "vitest";

// CHECK-IN REMINDER RECIPIENTS: the team's ACTIVE roster (not the legacy
// User.teamId), opted in to push, not yet checked in today.
//   - a removed player (ended membership) is no longer pinged
//   - a two-team athlete is reached through a team that isn't their legacy one
//   - no push subscription, or already checked in → skipped
//
// Same runner contract: localhost-only, self-skips without TEST_DATABASE_URL.

const url = process.env.TEST_DATABASE_URL;
const host = url ? new URL(url).hostname : null;
if (url && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("TEST_DATABASE_URL must point at localhost — this suite writes.");
}
if (url) process.env.DATABASE_URL = url;

const dbDescribe = url ? describe : describe.skip;
const TODAY = "2099-01-01"; // a day no seeded activity touches

dbDescribe("reminderRecipientIds", () => {
  const w = {} as {
    orgId: number;
    teamId: number;
    otherTeamId: number;
    ids: Record<"active" | "removed" | "noPush" | "checkedIn" | "twoTeam", number>;
    profileIds: number[];
  };

  beforeAll(async () => {
    const { prisma } = await import("../lib/prisma");
    const org = await prisma.organization.create({ data: { name: "__rm_org__" } });
    const season = await prisma.season.create({
      data: { organizationId: org.id, name: "2026", isCurrent: true },
    });
    const team = await prisma.team.create({
      data: { name: "__rm_team__", organizationId: org.id, joinCode: "RMTM01" },
    });
    const other = await prisma.team.create({
      data: { name: "__rm_other__", organizationId: org.id, joinCode: "RMTM02" },
    });

    async function player(key: string, opts: { legacyTeamId: number; ended?: boolean; push?: boolean }) {
      const user = await prisma.user.create({
        data: { name: `__rm_${key}__`, role: "PLAYER", teamId: opts.legacyTeamId },
      });
      const profile = await prisma.profile.create({ data: { userId: user.id, name: user.name } });
      await prisma.membership.create({
        data: {
          profileId: profile.id,
          teamId: team.id,
          seasonId: season.id,
          role: "PLAYER",
          endedAt: opts.ended ? new Date() : null,
        },
      });
      if (opts.push !== false) {
        await prisma.pushSubscription.create({
          data: { userId: user.id, endpoint: `https://push.example.test/${key}`, p256dh: "k", auth: "a" },
        });
      }
      return { userId: user.id, profileId: profile.id };
    }

    const active = await player("active", { legacyTeamId: team.id });
    const removed = await player("removed", { legacyTeamId: team.id, ended: true });
    const noPush = await player("nopush", { legacyTeamId: team.id, push: false });
    const checkedIn = await player("checkedin", { legacyTeamId: team.id });
    const twoTeam = await player("twoteam", { legacyTeamId: other.id });
    await prisma.journalEntry.create({
      data: { userId: checkedIn.userId, profileId: checkedIn.profileId, day: TODAY, reflection: "x" },
    });

    Object.assign(w, {
      orgId: org.id,
      teamId: team.id,
      otherTeamId: other.id,
      ids: {
        active: active.userId,
        removed: removed.userId,
        noPush: noPush.userId,
        checkedIn: checkedIn.userId,
        twoTeam: twoTeam.userId,
      },
      profileIds: [active, removed, noPush, checkedIn, twoTeam].map((p) => p.profileId),
    });
  });

  afterAll(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.membership.deleteMany({ where: { teamId: w.teamId } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(w.ids) } } });
    await prisma.profile.deleteMany({ where: { id: { in: w.profileIds } } });
    await prisma.season.deleteMany({ where: { organizationId: w.orgId } });
    await prisma.team.deleteMany({ where: { id: { in: [w.teamId, w.otherTeamId] } } });
    await prisma.organization.delete({ where: { id: w.orgId } });
    await prisma.$disconnect();
  });

  it("pings the active roster only — including a two-team athlete, never a removed player", async () => {
    const { reminderRecipientIds } = await import("../lib/reminders");
    const ids = await reminderRecipientIds(w.teamId, TODAY);
    expect(ids.sort()).toEqual([w.ids.active, w.ids.twoTeam].sort());
    expect(ids).not.toContain(w.ids.removed);
    expect(ids).not.toContain(w.ids.noPush);
    expect(ids).not.toContain(w.ids.checkedIn);
  });
});
