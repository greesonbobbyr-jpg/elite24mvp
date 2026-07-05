import { prisma } from "./prisma";
import { todayKey } from "./journal";
import { getTeamRanking } from "./leaderboard";

// Coach-facing team data. STRICTLY team-scoped (callers pass the coach's own
// teamId) and coach-only (enforced at the page/action). CHILD-SAFETY / PRIVACY:
// these queries NEVER select a journal `reflection` or any check-in text — a
// coach can see check-in STATUS + time, points, and quest counts, but never what
// a player wrote (CLAUDE.md section 3). Keep it that way.

export type RosterRow = {
  id: number;
  name: string;
  position: string | null;
  jerseyNumber: number | null;
  points: number;
  rank: number;
  checkedInAt: Date | null;
};

export type TeamOverview = {
  roster: RosterRow[];
  totalPlayers: number;
  checkedInToday: number;
  questsDoneToday: number;
};

// Last name for alphabetical roster ordering ("First Last" → "Last").
function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[parts.length - 1] ?? name).toLowerCase();
}

// The coach's team at a glance: every player on the team + today's check-in
// status, with the summary counts DERIVED from the same fetched sets (no extra
// count queries). Ranks reuse getTeamRanking.
export async function getTeamOverview(teamId: number): Promise<TeamOverview> {
  const day = todayKey();
  const [players, todayEntries, todayQuestLogs, ranking] = await Promise.all([
    prisma.user.findMany({
      where: { teamId, role: "PLAYER" },
      select: {
        id: true,
        name: true,
        profile: {
          select: { points: true, position: true, jerseyNumber: true },
        },
      },
    }),
    // status + time only — never the reflection text.
    prisma.journalEntry.findMany({
      where: { day, user: { teamId } },
      select: { userId: true, createdAt: true },
    }),
    prisma.questLog.findMany({
      where: { day, user: { teamId } },
      select: { userId: true },
    }),
    getTeamRanking(teamId),
  ]);

  const checkedInAtByUser = new Map(todayEntries.map((e) => [e.userId, e.createdAt]));
  const rankById = new Map(ranking.map((r) => [r.id, r.rank]));

  const roster: RosterRow[] = players
    .map((p) => ({
      id: p.id,
      name: p.name,
      position: p.profile?.position ?? null,
      jerseyNumber: p.profile?.jerseyNumber ?? null,
      points: p.profile?.points ?? 0,
      rank: rankById.get(p.id) ?? 0,
      checkedInAt: checkedInAtByUser.get(p.id) ?? null,
    }))
    .sort((a, b) => lastName(a.name).localeCompare(lastName(b.name)));

  return {
    roster,
    totalPlayers: players.length,
    checkedInToday: todayEntries.length,
    questsDoneToday: todayQuestLogs.length,
  };
}

export type PlayerCoachView = {
  id: number;
  name: string;
  position: string | null;
  jerseyNumber: number | null;
  heightInches: number | null;
  pointsPerGame: number | null;
  reboundsPerGame: number | null;
  assistsPerGame: number | null;
  points: number;
  rank: number;
  total: number;
  checkedInAt: Date | null;
  week: { checkins: number; questsDone: number; pointsEarned: number };
};

// Coach-only drill-in on ONE player. Returns null unless the target is a PLAYER
// on the coach's OWN team (page redirects on null) — mirrors the /brand/[id]
// same-team refusal. "This week" = trailing 7 calendar days. NEVER reads
// reflection text (only status/time + counts/sums).
export async function getPlayerCoachView(
  coachTeamId: number,
  playerId: number,
): Promise<PlayerCoachView | null> {
  const target = await prisma.user.findUnique({
    where: { id: playerId },
    include: { profile: true },
  });
  if (
    !target ||
    target.role !== "PLAYER" ||
    target.teamId !== coachTeamId ||
    !target.profile
  ) {
    return null;
  }

  // Trailing 7 days (today + previous 6), local midnight.
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartKey = todayKey(weekStart);

  const [todayEntry, checkins, questsDone, pointsAgg, ranking] =
    await Promise.all([
      prisma.journalEntry.findUnique({
        where: { userId_day: { userId: playerId, day: todayKey() } },
        select: { createdAt: true }, // status/time only — no reflection
      }),
      prisma.journalEntry.count({
        where: { userId: playerId, day: { gte: weekStartKey } },
      }),
      prisma.questLog.count({
        where: { userId: playerId, day: { gte: weekStartKey } },
      }),
      prisma.pointsLedger.aggregate({
        where: { userId: playerId, createdAt: { gte: weekStart } },
        _sum: { amount: true },
      }),
      getTeamRanking(coachTeamId),
    ]);

  const p = target.profile;
  return {
    id: target.id,
    name: target.name,
    position: p.position,
    jerseyNumber: p.jerseyNumber,
    heightInches: p.heightInches,
    pointsPerGame: p.pointsPerGame,
    reboundsPerGame: p.reboundsPerGame,
    assistsPerGame: p.assistsPerGame,
    points: p.points,
    rank: ranking.findIndex((r) => r.id === playerId) >= 0
      ? ranking.find((r) => r.id === playerId)!.rank
      : 0,
    total: ranking.length,
    checkedInAt: todayEntry?.createdAt ?? null,
    week: {
      checkins,
      questsDone,
      pointsEarned: pointsAgg._sum.amount ?? 0,
    },
  };
}
