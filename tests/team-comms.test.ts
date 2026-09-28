import { afterAll, describe, expect, it } from "vitest";

// STAGE 4c PROOFS, on the real local database — the owner's four watch-points:
//   1. Read-receipt denominators: memberships == legacy players for existing
//      data, and an ENDED membership neither inflates nor deflates X/Y.
//   2. TIME OUT: a two-team athlete only gets their ACTING team's takeover.
//   3. Author role snapshot survives a role change (an ASSISTANT_COACH post
//      still shows "Assistant Coach" after promotion to HEAD_COACH).
//   4. The wired matrix on comms: AC + GM CAN post notifications; AC + GM
//      CANNOT send TIME OUT; special posts / moderation are HC + ORG_ADMIN
//      only — each denial asserted through the same ctx→can path the actions
//      use.
//
// Same runner contract: localhost-only, self-skips without TEST_DATABASE_URL.

const url = process.env.TEST_DATABASE_URL;
const host = url ? new URL(url).hostname : null;
if (url && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("TEST_DATABASE_URL must point at localhost — this suite writes.");
}
if (url) process.env.DATABASE_URL = url;

const dbDescribe = url ? describe : describe.skip;

dbDescribe("Stage 4c board + notifications", () => {
  afterAll(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });

  async function teamA() {
    const { prisma } = await import("../lib/prisma");
    const team = await prisma.team.findFirstOrThrow({
      where: { organizationId: { not: null } },
      orderBy: { id: "asc" },
      include: { organization: { include: { seasons: { where: { isCurrent: true } } } } },
    });
    return { team, season: team.organization!.seasons[0] };
  }

  it("receipts: Y == ACTIVE current-season player memberships that had started when it was sent", async () => {
    const { prisma } = await import("../lib/prisma");
    const { getTeamReadStatus } = await import("../lib/notifications");
    const { team } = await teamA();

    // (Seed v2 diverges from the legacy user roster BY DESIGN: an ended
    // membership stays a user on the team; a two-team athlete is one user
    // with two memberships. The membership roster is the truth.)
    const active = await prisma.membership.findMany({
      where: { teamId: team.id, role: "PLAYER", endedAt: null, season: { isCurrent: true } },
      select: { startedAt: true },
    });
    const status = await getTeamReadStatus(team.id);
    expect(status.length).toBeGreaterThan(0);
    for (const n of status) {
      const onTeamWhenSent = active.filter((m) => m.startedAt <= n.createdAt).length;
      expect(n.totalPlayers).toBe(onTeamWhenSent);
      expect(n.readCount + n.notYet.length).toBe(n.totalPlayers);
    }
  });

  it("receipts: an ENDED membership neither inflates nor deflates 'Read by X of Y'", async () => {
    const { prisma } = await import("../lib/prisma");
    const { getTeamReadStatus } = await import("../lib/notifications");
    const { team, season } = await teamA();

    const baseline = (await getTeamReadStatus(team.id))[0].totalPlayers;

    const user = await prisma.user.create({
      data: { name: "__tc_ghost__", role: "PLAYER", teamId: team.id },
    });
    const profile = await prisma.profile.create({ data: { userId: user.id, name: user.name } });
    // Joined well before every seeded notification, so it's owed all of them.
    const membership = await prisma.membership.create({
      data: {
        profileId: profile.id,
        teamId: team.id,
        seasonId: season.id,
        role: "PLAYER",
        startedAt: new Date(Date.now() - 60 * 86_400_000),
      },
    });
    try {
      // Active → counted, listed under Waiting.
      let status = await getTeamReadStatus(team.id);
      expect(status[0].totalPlayers).toBe(baseline + 1);
      expect(status[0].notYet).toContain(user.name);

      // Ended → back to baseline, in NEITHER list.
      await prisma.membership.update({
        where: { id: membership.id },
        data: { endedAt: new Date() },
      });
      status = await getTeamReadStatus(team.id);
      expect(status[0].totalPlayers).toBe(baseline);
      expect(status[0].read).not.toContain(user.name);
      expect(status[0].notYet).not.toContain(user.name);
    } finally {
      await prisma.membership.delete({ where: { id: membership.id } });
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.profile.delete({ where: { id: profile.id } });
    }
  });

  it("TIME OUT: a two-team athlete only gets the ACTING team's takeover", async () => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser } = await import("../lib/context");
    const { getActiveTimeout } = await import("../lib/notifications");

    const teams = await prisma.team.findMany({
      where: { organizationId: { not: null } },
      orderBy: { id: "asc" },
      take: 2,
      include: { organization: { include: { seasons: { where: { isCurrent: true } } } } },
    });
    const [tA, tB] = teams;
    const coachB = await prisma.user.findFirstOrThrow({ where: { teamId: tB.id, role: "COACH" } });

    const user = await prisma.user.create({
      data: { name: "__tc_twoteam__", role: "PLAYER", teamId: tA.id },
    });
    const profile = await prisma.profile.create({ data: { userId: user.id, name: user.name } });
    const mA = await prisma.membership.create({
      data: { profileId: profile.id, teamId: tA.id, seasonId: tA.organization!.seasons[0].id, role: "PLAYER" },
    });
    const mB = await prisma.membership.create({
      data: { profileId: profile.id, teamId: tB.id, seasonId: tB.organization!.seasons[0].id, role: "PLAYER" },
    });
    const timeoutB = await prisma.notification.create({
      data: {
        teamId: tB.id, authorId: coachB.id, isTimeout: true,
        title: "__tc_timeout__", body: "b",
      },
    });
    try {
      // Acting team A (cookie hint) → team B's takeover must NOT fire. (Team A
      // may have its own seeded TIME OUT — that one is legitimately allowed.)
      const ctxA = await resolveContextForUser(user.id, String(mA.id));
      expect(ctxA!.membership!.teamId).toBe(tA.id);
      const activeA = await getActiveTimeout(user.id, ctxA!.membership!.teamId);
      expect(activeA?.id).not.toBe(timeoutB.id);
      if (activeA) expect(activeA.teamId).toBe(tA.id);

      // Acting team B → it fires.
      const ctxB = await resolveContextForUser(user.id, String(mB.id));
      expect(ctxB!.membership!.teamId).toBe(tB.id);
      const active = await getActiveTimeout(user.id, ctxB!.membership!.teamId);
      expect(active?.id).toBe(timeoutB.id);
    } finally {
      await prisma.notification.delete({ where: { id: timeoutB.id } });
      await prisma.membership.deleteMany({ where: { id: { in: [mA.id, mB.id] } } });
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.profile.delete({ where: { id: profile.id } });
    }
  });

  it("a player who joins late isn't handed old alerts: no TIME OUT, nothing unread, not 'waiting'", async () => {
    const { prisma } = await import("../lib/prisma");
    const {
      getActiveTimeout,
      countUnreadForPlayer,
      listPlayerNotifications,
      getTeamReadStatus,
    } = await import("../lib/notifications");
    const { team, season } = await teamA();
    const coach = await prisma.user.findFirstOrThrow({ where: { teamId: team.id, role: "COACH" } });

    // An unacknowledged TIME OUT sent an hour ago, BEFORE the player joins.
    const oldTimeout = await prisma.notification.create({
      data: {
        teamId: team.id, authorId: coach.id, isTimeout: true,
        title: "__tc_old_timeout__", body: "b",
        createdAt: new Date(Date.now() - 3_600_000),
      },
    });
    const user = await prisma.user.create({
      data: { name: "__tc_late__", role: "PLAYER", teamId: team.id },
    });
    const profile = await prisma.profile.create({ data: { userId: user.id, name: user.name } });
    const membership = await prisma.membership.create({
      data: { profileId: profile.id, teamId: team.id, seasonId: season.id, role: "PLAYER" },
    });
    const joinedAt = membership.startedAt;
    let newTimeoutId: number | null = null;
    try {
      expect(await getActiveTimeout(user.id, team.id, joinedAt)).toBeNull();
      expect(await countUnreadForPlayer(user.id, team.id, joinedAt)).toBe(0);
      const feed = await listPlayerNotifications(user.id, team.id, joinedAt);
      expect(feed.unread).toHaveLength(0);
      const receipts = await getTeamReadStatus(team.id);
      expect(receipts.find((n) => n.id === oldTimeout.id)?.notYet).not.toContain(user.name);

      // Anything sent AFTER joining reaches them as usual.
      const fresh = await prisma.notification.create({
        data: {
          teamId: team.id, authorId: coach.id, isTimeout: true,
          title: "__tc_new_timeout__", body: "b",
          createdAt: new Date(joinedAt.getTime() + 1_000),
        },
      });
      newTimeoutId = fresh.id;
      expect((await getActiveTimeout(user.id, team.id, joinedAt))?.id).toBe(fresh.id);
      expect(await countUnreadForPlayer(user.id, team.id, joinedAt)).toBe(1);
    } finally {
      await prisma.notification.deleteMany({
        where: { id: { in: [oldTimeout.id, ...(newTimeoutId ? [newTimeoutId] : [])] } },
      });
      await prisma.membership.delete({ where: { id: membership.id } });
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.profile.delete({ where: { id: profile.id } });
    }
  });

  it("every unread alert is listed (even past 50), so the badge can always reach 0", async () => {
    const { prisma } = await import("../lib/prisma");
    const { countUnreadForPlayer, listPlayerNotifications } = await import("../lib/notifications");

    const org = await prisma.organization.create({ data: { name: "__tc_many_org__" } });
    const team = await prisma.team.create({
      data: { name: "__tc_many_team__", organizationId: org.id, joinCode: "TCMANY" },
    });
    const coach = await prisma.user.create({
      data: { name: "__tc_many_coach__", role: "COACH", teamId: team.id },
    });
    const player = await prisma.user.create({
      data: { name: "__tc_many_player__", role: "PLAYER", teamId: team.id },
    });
    try {
      const since = new Date(Date.now() - 86_400_000);
      await prisma.notification.createMany({
        data: Array.from({ length: 55 }, (_, i) => ({
          teamId: team.id, authorId: coach.id, title: `__tc_many_${i}__`, body: "b",
          createdAt: new Date(since.getTime() + (i + 1) * 60_000),
        })),
      });
      expect(await countUnreadForPlayer(player.id, team.id, since)).toBe(55);
      const feed = await listPlayerNotifications(player.id, team.id, since);
      expect(feed.unread).toHaveLength(55);

      // Confirm everything the list offers → the badge is clear.
      await prisma.notificationRead.createMany({
        data: feed.unread.map((n) => ({ notificationId: n.id, userId: player.id })),
      });
      expect(await countUnreadForPlayer(player.id, team.id, since)).toBe(0);
    } finally {
      await prisma.notification.deleteMany({ where: { teamId: team.id } });
      await prisma.user.deleteMany({ where: { id: { in: [coach.id, player.id] } } });
      await prisma.team.delete({ where: { id: team.id } });
      await prisma.organization.delete({ where: { id: org.id } });
    }
  });

  it("actingTeamId: the acting membership's team, else the legacy anchor", async () => {
    const { actingTeamId } = await import("../lib/context");
    const user = { teamId: 1 } as Parameters<typeof actingTeamId>[0]["user"];
    const membership = { teamId: 2 } as NonNullable<Parameters<typeof actingTeamId>[0]["membership"]>;
    expect(actingTeamId({ user, membership })).toBe(2);
    expect(actingTeamId({ user, membership: null })).toBe(1);
  });

  it("author role snapshot survives promotion (Assistant Coach stays Assistant Coach)", async () => {
    const { prisma } = await import("../lib/prisma");
    const { listTeamMessages } = await import("../lib/board");
    const { roleLabel } = await import("../lib/format");
    const { team, season } = await teamA();

    const user = await prisma.user.create({
      data: { name: "__tc_ac__", role: "COACH", teamId: team.id },
    });
    const profile = await prisma.profile.create({ data: { userId: user.id, name: user.name } });
    const membership = await prisma.membership.create({
      data: { profileId: profile.id, teamId: team.id, seasonId: season.id, role: "ASSISTANT_COACH" },
    });
    const message = await prisma.teamMessage.create({
      data: {
        teamId: team.id, authorId: user.id, body: "__tc_snapshot__",
        authorProfileId: profile.id, authorRole: "ASSISTANT_COACH", // as postMessage stamps
      },
    });
    try {
      // PROMOTE after the post.
      await prisma.membership.update({
        where: { id: membership.id },
        data: { role: "HEAD_COACH" },
      });
      const messages = await listTeamMessages(team.id, 600);
      const mine = messages.find((m) => m.id === message.id);
      expect(mine).toBeDefined();
      expect(roleLabel(mine!.authorRole)).toBe("Assistant Coach"); // snapshot, not live role
    } finally {
      await prisma.teamMessage.delete({ where: { id: message.id } });
      await prisma.membership.delete({ where: { id: membership.id } });
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.profile.delete({ where: { id: profile.id } });
    }
  });

  it("wired matrix: AC/GM can post, cannot TIME OUT, cannot special/moderate; HC + ORG_ADMIN can", async () => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser, actingScope } = await import("../lib/context");
    const { can } = await import("../lib/authz");
    const { team, season } = await teamA();

    async function staffCtx(role: "ASSISTANT_COACH" | "GENERAL_MANAGER" | "HEAD_COACH") {
      const user = await prisma.user.create({
        data: { name: `__tc_${role}__`, role: "COACH", teamId: team.id },
      });
      const profile = await prisma.profile.create({ data: { userId: user.id, name: user.name } });
      const membership = await prisma.membership.create({
        data: { profileId: profile.id, teamId: team.id, seasonId: season.id, role },
      });
      const ctx = (await resolveContextForUser(user.id))!;
      return { ctx, cleanup: async () => {
        await prisma.membership.delete({ where: { id: membership.id } });
        await prisma.user.delete({ where: { id: user.id } });
        await prisma.profile.delete({ where: { id: profile.id } });
      } };
    }

    const ac = await staffCtx("ASSISTANT_COACH");
    const gm = await staffCtx("GENERAL_MANAGER");
    const hc = await staffCtx("HEAD_COACH");
    try {
      for (const { ctx } of [ac, gm]) {
        const scope = actingScope(ctx)!;
        expect(scope.teamId).toBe(team.id);
        expect(can(ctx, "post_notification", scope)).toBe(true);   // CAN post
        expect(can(ctx, "send_timeout", scope)).toBe(false);       // DENIED
        expect(can(ctx, "post_special_message", scope)).toBe(false); // DENIED
        expect(can(ctx, "moderate_board", scope)).toBe(false);     // DENIED
      }
      const hcScope = actingScope(hc.ctx)!;
      expect(can(hc.ctx, "send_timeout", hcScope)).toBe(true);
      expect(can(hc.ctx, "post_special_message", hcScope)).toBe(true);
      expect(can(hc.ctx, "moderate_board", hcScope)).toBe(true);

      // Seeded real head coach (HEAD_COACH membership + ORG_ADMIN grant) —
      // full set. (Seed v2 also has an AC/GM on this team — filter by grant.)
      const realCoach = await prisma.user.findFirstOrThrow({
        where: {
          teamId: team.id,
          role: "COACH",
          profileRecord: {
            roleAssignments: { some: { role: "ORG_ADMIN", revokedAt: null } },
            memberships: { some: { teamId: team.id, endedAt: null } },
          },
        },
      });
      const coachCtx = (await resolveContextForUser(realCoach.id))!;
      const coachScope = actingScope(coachCtx)!;
      for (const action of ["post_notification", "send_timeout", "post_special_message", "moderate_board"] as const) {
        expect(can(coachCtx, action, coachScope)).toBe(true);
      }
    } finally {
      await ac.cleanup();
      await gm.cleanup();
      await hc.cleanup();
    }
  });
});
