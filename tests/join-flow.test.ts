import { afterAll, beforeAll, describe, expect, it } from "vitest";

// JOINING A TEAM, SEASONS, AND THE SETUP GATE:
//   1. An org with NO current season fails the join with a clear reason —
//      never a silent membership skip.
//   2. A returning athlete joining a DIFFERENT team gets a fresh membership on
//      their EXISTING profile: career/journal carry, that board starts 0, and
//      they are now acting on the new team.
//   3. Re-joining the SAME team + season REACTIVATES the exact membership
//      (board points return); joining while already active is a no-op.
//   4. Season rollover carries STAFF memberships, not players; exactly one
//      current season holds; a player then re-joins into the new season fresh.
//   5. The setup gate reads Profile.setupCompletedAt (players gate until the
//      Dream; staff pass).
//
// Same runner contract: localhost-only, self-skips without TEST_DATABASE_URL.

const url = process.env.TEST_DATABASE_URL;
const host = url ? new URL(url).hostname : null;
if (url && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("TEST_DATABASE_URL must point at localhost — this suite writes.");
}
if (url) process.env.DATABASE_URL = url;

const dbDescribe = url ? describe : describe.skip;

describe("setup gate (pure)", () => {
  it("athletes gate on Profile.setupCompletedAt; staff, admins and the CEO pass", async () => {
    const { isSetUp } = await import("../lib/onboarding");
    const player = { role: "PLAYER" } as never; // acting membership roles
    const coach = { role: "HEAD_COACH" } as never;
    const none = { membership: null, orgAdminOf: [] as number[] };
    const notYet = { setupCompletedAt: null };
    const done = { setupCompletedAt: new Date() };
    // Athlete on a team, with/without setup
    expect(isSetUp({ ...none, membership: player, profile: notYet })).toBe(false);
    expect(isSetUp({ ...none, membership: player, profile: done })).toBe(true);
    // Staff, org admins and the CEO always pass
    expect(isSetUp({ ...none, membership: coach, profile: notYet })).toBe(true);
    expect(isSetUp({ ...none, orgAdminOf: [1], profile: notYet })).toBe(true);
    expect(isSetUp({ ...none, platformRole: "CEO", profile: notYet })).toBe(true);
    // No team: set up = personal athlete; not yet = must pick a path / write the Dream
    expect(isSetUp({ ...none, profile: done })).toBe(true);
    expect(isSetUp({ ...none, profile: notYet })).toBe(false);
  });
});

dbDescribe("join flow + season rollover", () => {
  const w = {} as {
    orgId: number; seasonId: number;
    teamXId: number; teamYId: number; codeX: string; codeY: string;
    noSeasonTeamCode: string;
    userId: number; profileId: number;
    coachUserId: number; coachProfileId: number;
  };

  beforeAll(async () => {
    const { prisma } = await import("../lib/prisma");
    // Isolated org with two teams + join codes; a second org with NO season.
    const org = await prisma.organization.create({ data: { name: "__jf_org__" } });
    const season = await prisma.season.create({
      data: { organizationId: org.id, name: "2026", isCurrent: true },
    });
    const teamX = await prisma.team.create({
      data: { name: "__jf_teamX__", organizationId: org.id, joinCode: "JFTX01" },
    });
    const teamY = await prisma.team.create({
      data: { name: "__jf_teamY__", organizationId: org.id, joinCode: "JFTY01" },
    });
    const orgDark = await prisma.organization.create({ data: { name: "__jf_dark__" } });
    await prisma.team.create({
      data: { name: "__jf_darkteam__", organizationId: orgDark.id, joinCode: "JFDARK" },
    });
    // The athlete: on team X with history (points + journal), then removed.
    const user = await prisma.user.create({ data: { name: "__jf_athlete__" } });
    const profile = await prisma.profile.create({
      data: { userId: user.id, name: user.name, dream: "t", setupCompletedAt: new Date() },
    });
    const mX = await prisma.membership.create({
      data: { profileId: profile.id, teamId: teamX.id, seasonId: season.id, role: "PLAYER" },
    });
    const { performAdjustPoints } = await import("../lib/data/points");
    await performAdjustPoints({ id: user.id, teamId: teamX.id }, 30, "history");
    await prisma.journalEntry.create({
      data: { userId: user.id, profileId: profile.id, reflection: "x", day: "2031-06-01" },
    });
    void mX;
    // A staff member on team X (to prove rollover carry).
    const coach = await prisma.user.create({ data: { name: "__jf_coach__" } });
    const coachProfile = await prisma.profile.create({
      data: { userId: coach.id, name: coach.name, setupCompletedAt: new Date() },
    });
    await prisma.membership.create({
      data: { profileId: coachProfile.id, teamId: teamX.id, seasonId: season.id, role: "HEAD_COACH" },
    });
    Object.assign(w, {
      orgId: org.id, seasonId: season.id,
      teamXId: teamX.id, teamYId: teamY.id, codeX: "JFTX01", codeY: "JFTY01",
      noSeasonTeamCode: "JFDARK",
      userId: user.id, profileId: profile.id,
      coachUserId: coach.id, coachProfileId: coachProfile.id,
    });
  });

  afterAll(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.user.deleteMany({ where: { id: { in: [w.userId, w.coachUserId] } } });
    await prisma.membership.deleteMany({ where: { profileId: { in: [w.profileId, w.coachProfileId] } } });
    await prisma.profile.deleteMany({ where: { id: { in: [w.profileId, w.coachProfileId] } } });
    await prisma.season.deleteMany({ where: { organization: { name: "__jf_org__" } } });
    await prisma.team.deleteMany({ where: { id: { in: [w.teamXId, w.teamYId] } } });
    await prisma.team.deleteMany({ where: { name: "__jf_darkteam__" } });
    await prisma.organization.deleteMany({ where: { name: { in: ["__jf_org__", "__jf_dark__"] } } });
    await prisma.$disconnect();
  });

  it("a team whose org has NO current season fails the join with a clear reason", async () => {
    const { resolveJoinableTeam } = await import("../lib/data/join");
    expect(await resolveJoinableTeam(w.noSeasonTeamCode)).toEqual({
      ok: false,
      reason: "no_current_season",
    });
    expect(await resolveJoinableTeam("NOPE99")).toEqual({ ok: false, reason: "bad_code" });
  });

  it("returning athlete → DIFFERENT team: fresh membership on the SAME profile; history carries; they act on the new team", async () => {
    const { prisma } = await import("../lib/prisma");
    const { endMembershipForUser } = await import("../lib/data/memberships");
    const { resolveJoinableTeam, joinTeamForProfile } = await import("../lib/data/join");
    const { getTeamRanking } = await import("../lib/leaderboard");

    // Coach removes them from X, then they join Y by code.
    await endMembershipForUser(w.userId, w.teamXId, w.coachProfileId);
    const joinable = await resolveJoinableTeam(w.codeY);
    expect(joinable.ok).toBe(true);
    if (!joinable.ok) return;
    const result = await joinTeamForProfile(w.profileId, joinable.team.id, joinable.seasonId);
    expect(result.reactivated).toBe(false);
    expect(result.alreadyActive).toBe(false);

    const boardY = await getTeamRanking(w.teamYId);
    expect(boardY.find((r) => r.id === w.userId)?.points).toBe(0); // fresh board
    const profile = await prisma.profile.findUniqueOrThrow({ where: { id: w.profileId } });
    expect(profile.careerPoints).toBe(30); // career carries
    expect(await prisma.journalEntry.count({ where: { userId: w.userId } })).toBe(1); // journal carries
    const { resolveContextForUser } = await import("../lib/context");
    const ctx = (await resolveContextForUser(w.userId, null))!;
    expect(ctx.membership?.teamId).toBe(w.teamYId); // acting on the team they just joined
    expect(ctx.memberships).toHaveLength(1); // the ended one on X is not active
  });

  it("re-join SAME team + season reactivates (board points return); active join is a no-op", async () => {
    const { prisma } = await import("../lib/prisma");
    const { endMembershipForUser } = await import("../lib/data/memberships");
    const { resolveJoinableTeam, joinTeamForProfile } = await import("../lib/data/join");
    const { getTeamRanking } = await import("../lib/leaderboard");

    // Leave Y, go back to X — where their 30 points live.
    await endMembershipForUser(w.userId, w.teamYId, null);
    const joinable = await resolveJoinableTeam(w.codeX);
    if (!joinable.ok) throw new Error("unexpected");
    const back = await joinTeamForProfile(w.profileId, joinable.team.id, joinable.seasonId);
    expect(back.reactivated).toBe(true); // the SAME membership, revived

    const boardX = await getTeamRanking(w.teamXId);
    expect(boardX.find((r) => r.id === w.userId)?.points).toBe(30); // history returns
    const sum = await prisma.pointsLedger.aggregate({
      where: { membershipId: back.membershipId }, _sum: { amount: true },
    });
    expect(sum._sum.amount).toBe(30); // invariant intact through the round trip

    // Joining again while active: no-op.
    const again = await joinTeamForProfile(w.profileId, joinable.team.id, joinable.seasonId);
    expect(again.alreadyActive).toBe(true);
    expect(again.membershipId).toBe(back.membershipId);
  });

  it("rollover: staff carry, players don't; one current season; player re-joins fresh into the new season", async () => {
    const { prisma } = await import("../lib/prisma");
    const { rolloverSeason } = await import("../lib/seasons");
    const { resolveJoinableTeam, joinTeamForProfile } = await import("../lib/data/join");
    const { getTeamRanking } = await import("../lib/leaderboard");

    const { season, staffCarried } = await rolloverSeason(w.orgId, "2027");
    expect(staffCarried).toBe(1); // the head coach

    // Exactly one current season; the coach has a membership in it, the player doesn't.
    expect(await prisma.season.count({ where: { organizationId: w.orgId, isCurrent: true } })).toBe(1);
    expect(await prisma.membership.count({
      where: { profileId: w.coachProfileId, seasonId: season.id, endedAt: null },
    })).toBe(1);
    expect(await prisma.membership.count({
      where: { profileId: w.profileId, seasonId: season.id },
    })).toBe(0);

    // The player is off the (new-season) board until they re-join by code…
    expect((await getTeamRanking(w.teamXId)).find((r) => r.id === w.userId)).toBeUndefined();
    const joinable = await resolveJoinableTeam(w.codeX);
    if (!joinable.ok) throw new Error("unexpected");
    expect(joinable.seasonId).toBe(season.id); // the code resolves into the NEW season
    const rejoin = await joinTeamForProfile(w.profileId, joinable.team.id, joinable.seasonId);
    expect(rejoin.reactivated).toBe(false); // fresh season = fresh membership

    const board = await getTeamRanking(w.teamXId);
    expect(board.find((r) => r.id === w.userId)?.points).toBe(0); // fresh board
    const profile = await prisma.profile.findUniqueOrThrow({ where: { id: w.profileId } });
    expect(profile.careerPoints).toBe(30); // career still carries
  });
});
