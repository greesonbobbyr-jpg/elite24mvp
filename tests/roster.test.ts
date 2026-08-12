import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// STAGE 4e PROOFS — the highest-risk stage: Remove becomes endMembership.
//   1. Ending team A's membership for a TWO-TEAM athlete touches NOTHING but
//      that one membership: team B's membership/board/points, the User,
//      Profile, careerPoints, journal, and streaks are all intact.
//   2. NO code path in app/ or lib/ deletes a User or Profile (source scan) —
//      person deletion is operator-script-only.
//   3. Re-join semantics: same team + same season REACTIVATES the exact
//      membership (the unique slot + its ledger rows demand it — board points
//      return); a different team/season gets a FRESH membership (board starts
//      at 0, career intact).
//   4. adjustPoints credits the membership of the ADJUSTING team for a
//      two-team athlete; careerPoints and that membership's points both move,
//      the other team's don't.
//   5. Role matrix through the wired path: AC views but can't end/adjust;
//      GM ends but can't adjust; HC does both.
//   6. Takeaway visibility is at-time scoped: the stamped team's staff view
//      shows it; the other team's staff view does not.

const url = process.env.TEST_DATABASE_URL;
const host = url ? new URL(url).hostname : null;
if (url && host !== "localhost" && host !== "127.0.0.1") {
  throw new Error("TEST_DATABASE_URL must point at localhost — this suite writes.");
}
if (url) process.env.DATABASE_URL = url;

const dbDescribe = url ? describe : describe.skip;

// ---- Proof 2 runs even without a database: a pure source scan. ------------
describe("no hard-delete path remains", () => {
  it("app/ and lib/ contain no User or Profile delete call", () => {
    const violations: string[] = [];
    const PATTERN = /\b(?:prisma|tx)\.(?:user|profile)\.(?:delete|deleteMany)\b/;
    function* walk(dir: string): Generator<string> {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(path);
        else if (/\.(ts|tsx)$/.test(entry.name)) yield path;
      }
    }
    for (const root of ["app", "lib"]) {
      for (const file of walk(root)) {
        readFileSync(file, "utf8").split("\n").forEach((line, i) => {
          if (PATTERN.test(line)) violations.push(`${file}:${i + 1}`);
        });
      }
    }
    expect(violations).toEqual([]);
  });
});

dbDescribe("Stage 4e — endMembership + coach surfaces", () => {
  const w = {} as {
    teamA: number; teamB: number; seasonA: number; seasonB: number;
    userId: number; profileId: number; mA: number; mB: number;
    coachAId: number;
  };

  beforeAll(async () => {
    const { prisma } = await import("../lib/prisma");
    // Two seeded teams/orgs; a synthetic two-team athlete with history on both.
    // NB: Prisma's startsWith doesn't escape `_` (SQL LIKE wildcard), so the
    // test-artifact filter happens in JS.
    const teams = (
      await prisma.team.findMany({
        where: { organizationId: { not: null } },
        orderBy: { id: "asc" },
        include: { organization: { include: { seasons: { where: { isCurrent: true } } } } },
      })
    )
      .filter((t) => !t.name.startsWith("__"))
      .slice(0, 2);
    const [tA, tB] = teams;
    const coachA = await prisma.user.findFirstOrThrow({ where: { teamId: tA.id, role: "COACH" } });
    const user = await prisma.user.create({
      data: { name: "__ro_twoteam__", role: "PLAYER", teamId: tA.id },
    });
    await prisma.playerProfile.create({
      data: { userId: user.id, dream: "t", onboardedAt: new Date(), points: 0, currentStreak: 4, bestStreak: 9 },
    });
    const profile = await prisma.profile.create({
      data: { userId: user.id, name: user.name, currentStreak: 4, bestStreak: 9 },
    });
    const mA = await prisma.membership.create({
      data: { profileId: profile.id, teamId: tA.id, seasonId: tA.organization!.seasons[0].id, role: "PLAYER" },
    });
    const mB = await prisma.membership.create({
      data: { profileId: profile.id, teamId: tB.id, seasonId: tB.organization!.seasons[0].id, role: "PLAYER" },
    });
    // History: points on BOTH teams + a journal entry.
    const { performAdjustPoints } = await import("../lib/data/points");
    await performAdjustPoints({ id: user.id, teamId: tA.id }, 40, "A work");
    await performAdjustPoints({ id: user.id, teamId: tB.id }, 25, "B work");
    await prisma.journalEntry.create({
      data: { userId: user.id, profileId: profile.id, reflection: "grind", day: "2031-05-01" },
    });
    Object.assign(w, {
      teamA: tA.id, teamB: tB.id,
      seasonA: tA.organization!.seasons[0].id, seasonB: tB.organization!.seasons[0].id,
      userId: user.id, profileId: profile.id, mA: mA.id, mB: mB.id, coachAId: coachA.id,
    });
  });

  afterAll(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.user.deleteMany({ where: { name: { startsWith: "__ro_" } } });
    await prisma.membership.deleteMany({ where: { profile: { name: { startsWith: "__ro_" } } } });
    await prisma.profile.deleteMany({ where: { name: { startsWith: "__ro_" } } });
    await prisma.$disconnect();
  });

  it("adjustPoints credits the ADJUSTING team's membership only; career moves once per award", async () => {
    const { prisma } = await import("../lib/prisma");
    const [mA, mB, profile] = await Promise.all([
      prisma.membership.findUniqueOrThrow({ where: { id: w.mA } }),
      prisma.membership.findUniqueOrThrow({ where: { id: w.mB } }),
      prisma.profile.findUniqueOrThrow({ where: { id: w.profileId } }),
    ]);
    expect(mA.points).toBe(40); // team A award landed on A
    expect(mB.points).toBe(25); // team B award landed on B
    expect(profile.careerPoints).toBe(65); // career = both
  });

  it("ending team A's membership touches NOTHING else (two-team athlete)", async () => {
    const { prisma } = await import("../lib/prisma");
    const { endMembershipForUser } = await import("../lib/data/memberships");
    const { getTeamRanking } = await import("../lib/leaderboard");

    const coachProfile = await prisma.profile.findUniqueOrThrow({
      where: { userId: w.coachAId }, select: { id: true },
    });
    const result = await endMembershipForUser(w.userId, w.teamA, coachProfile.id);
    expect(result).toEqual({ ok: true, membershipId: w.mA });

    // The ended membership: ended, audited, points cache untouched.
    const mA = await prisma.membership.findUniqueOrThrow({ where: { id: w.mA } });
    expect(mA.endedAt).not.toBeNull();
    expect(mA.endedByProfileId).toBe(coachProfile.id);
    expect(mA.points).toBe(40);

    // COMPLETELY untouched: team B membership + its board spot...
    const mB = await prisma.membership.findUniqueOrThrow({ where: { id: w.mB } });
    expect(mB.endedAt).toBeNull();
    expect(mB.points).toBe(25);
    const boardB = await getTeamRanking(w.teamB);
    expect(boardB.find((r) => r.id === w.userId)?.points).toBe(25);
    const boardA = await getTeamRanking(w.teamA);
    expect(boardA.find((r) => r.id === w.userId)).toBeUndefined(); // off A's board

    // ...the person and their history:
    const user = await prisma.user.findUnique({ where: { id: w.userId } });
    expect(user).not.toBeNull(); // login intact
    const profile = await prisma.profile.findUniqueOrThrow({ where: { id: w.profileId } });
    expect(profile.careerPoints).toBe(65); // career intact
    expect(profile.currentStreak).toBe(4); // streaks intact
    expect(profile.bestStreak).toBe(9);
    expect(await prisma.journalEntry.count({ where: { userId: w.userId } })).toBe(1); // journal intact
    expect(await prisma.pointsLedger.count({ where: { profileId: w.profileId } })).toBe(2); // ledger intact
  });

  it("re-join same team+season REACTIVATES the same membership (board points return)", async () => {
    const { prisma } = await import("../lib/prisma");
    const { Prisma } = await import("@prisma/client");

    // A fresh row in the same (profile, team, season) slot is IMPOSSIBLE —
    // the unique constraint holds it for reactivation.
    await expect(
      prisma.membership.create({
        data: { profileId: w.profileId, teamId: w.teamA, seasonId: w.seasonA, role: "PLAYER" },
      }),
    ).rejects.toSatisfy(
      (e) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002",
    );

    // Reactivation restores the roster spot AND the board points (its ledger
    // rows still credit this membership — the sum invariant requires it).
    await prisma.membership.update({
      where: { id: w.mA },
      data: { endedAt: null, endedByProfileId: null },
    });
    const { getTeamRanking } = await import("../lib/leaderboard");
    const boardA = await getTeamRanking(w.teamA);
    expect(boardA.find((r) => r.id === w.userId)?.points).toBe(40); // history back

    // Sum invariant holds through the whole end/reactivate cycle.
    const sum = await prisma.pointsLedger.aggregate({
      where: { membershipId: w.mA }, _sum: { amount: true },
    });
    expect(sum._sum.amount).toBe(40);
  });

  it("a DIFFERENT team gets a FRESH membership: board 0, career intact", async () => {
    const { prisma } = await import("../lib/prisma");
    // New team in org A (same season) — the returning-athlete shape at 4f.
    const teamC = await prisma.team.create({
      data: {
        name: "__ro_teamC__",
        organizationId: (await prisma.team.findUniqueOrThrow({ where: { id: w.teamA } })).organizationId,
      },
    });
    const mC = await prisma.membership.create({
      data: { profileId: w.profileId, teamId: teamC.id, seasonId: w.seasonA, role: "PLAYER" },
    });
    try {
      const { getTeamRanking } = await import("../lib/leaderboard");
      const boardC = await getTeamRanking(teamC.id);
      expect(boardC.find((r) => r.id === w.userId)?.points).toBe(0); // fresh board
      const profile = await prisma.profile.findUniqueOrThrow({ where: { id: w.profileId } });
      expect(profile.careerPoints).toBe(65); // career carries
    } finally {
      await prisma.membership.delete({ where: { id: mC.id } });
      await prisma.team.delete({ where: { id: teamC.id } });
    }
  });

  it("role matrix on roster surfaces: AC views only; GM ends but no adjust; HC both", async () => {
    const { prisma } = await import("../lib/prisma");
    const { resolveContextForUser, actingScope } = await import("../lib/context");
    const { can } = await import("../lib/authz");

    async function staff(role: "ASSISTANT_COACH" | "GENERAL_MANAGER" | "HEAD_COACH") {
      const user = await prisma.user.create({
        data: { name: `__ro_${role}__`, role: "COACH", teamId: w.teamA },
      });
      const profile = await prisma.profile.create({ data: { userId: user.id, name: user.name } });
      await prisma.membership.create({
        data: { profileId: profile.id, teamId: w.teamA, seasonId: w.seasonA, role },
      });
      return (await resolveContextForUser(user.id))!;
    }
    const [ac, gm, hc] = await Promise.all([
      staff("ASSISTANT_COACH"), staff("GENERAL_MANAGER"), staff("HEAD_COACH"),
    ]);
    const check = (ctx: Awaited<ReturnType<typeof resolveContextForUser>>) => {
      const scope = actingScope(ctx!)!;
      return {
        roster: can(ctx!, "view_roster", scope),
        detail: can(ctx!, "view_player_detail", scope),
        end: can(ctx!, "end_membership", scope),
        adjust: can(ctx!, "adjust_points", scope),
        settings: can(ctx!, "team_settings", scope),
        takeaways: can(ctx!, "view_takeaways", scope),
      };
    };
    expect(check(ac)).toEqual({ roster: true, detail: true, end: false, adjust: false, settings: false, takeaways: true });
    expect(check(gm)).toEqual({ roster: true, detail: true, end: true, adjust: false, settings: false, takeaways: false });
    expect(check(hc)).toEqual({ roster: true, detail: true, end: true, adjust: true, settings: true, takeaways: true });
  });

  it("takeaway is at-time scoped: stamped team's staff see it, the other team's staff don't", async () => {
    const { prisma } = await import("../lib/prisma");
    const { getPlayerCoachView } = await import("../lib/coach");
    const { todayKey } = await import("../lib/daykey");

    // The athlete (active on A after reactivation, and on B) writes today's
    // takeaway ACTING FOR TEAM B — stamped with membership B.
    const takeaway = await prisma.mindsetTakeaway.create({
      data: {
        userId: w.userId, day: todayKey(), text: "__ro_takeaway__",
        profileId: w.profileId, membershipId: w.mB,
      },
    });
    try {
      const viewB = await getPlayerCoachView(w.teamB, w.userId);
      expect(viewB?.mindsetTakeaway).toBe("__ro_takeaway__"); // that day's team: visible
      const viewA = await getPlayerCoachView(w.teamA, w.userId);
      expect(viewA).not.toBeNull(); // A's staff still see the player...
      expect(viewA!.mindsetTakeaway).toBeNull(); // ...but never B's takeaway
      // And the GM gate blanks it even on the right team:
      const viewGM = await getPlayerCoachView(w.teamB, w.userId, false);
      expect(viewGM!.mindsetTakeaway).toBeNull();
    } finally {
      await prisma.mindsetTakeaway.delete({ where: { id: takeaway.id } });
    }
  });
});
