import { prisma } from "./prisma";
import { todayKey } from "./journal";
import {
  checkInCountForPlayer,
  checkInTimeForPlayer,
  checkInTimesForUsers,
  reviewDoneForPlayer,
} from "./data/reflections";
import { getTeamRanking } from "./leaderboard";

// Staff-facing team data (Stage 4e: rosters come from ACTIVE memberships in
// the current season — an ended membership is off every list here; the
// athlete's data is untouched). STRICTLY team-scoped (callers pass their own
// acting teamId) and staff-only (enforced at the page/action via the matrix).
// CHILD-SAFETY / PRIVACY: these queries NEVER select a journal `reflection` or
// any check-in text — staff see check-in STATUS + time, points, and quest
// counts, but never what a player wrote (CLAUDE.md section 3). Keep it that way.

export type RosterRow = {
  id: number;
  name: string;
  position: string | null;
  jerseyNumber: number | null;
  photoUrl: string | null;
  points: number;
  rank: number;
  checkedInAt: Date | null;
  currentStreak: number;
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

// The team's ACTIVE PLAYER roster: [userId, display fields] from memberships,
// with a legacy user-roster fallback for pre-backfill teams (dies at Stage 6).
async function activeRoster(teamId: number) {
  const memberships = await prisma.membership.findMany({
    where: { teamId, role: "PLAYER", endedAt: null, season: { isCurrent: true } },
    include: {
      profile: {
        select: {
          userId: true,
          name: true,
          position: true,
          jerseyNumber: true,
          photoUrl: true,
          currentStreak: true,
        },
      },
    },
  });
  if (memberships.length > 0) {
    return memberships
      .filter((m) => m.profile.userId != null)
      .map((m) => ({
        id: m.profile.userId!,
        name: m.profile.name,
        position: m.profile.position,
        jerseyNumber: m.jerseyNumber ?? m.profile.jerseyNumber,
        photoUrl: m.profile.photoUrl,
        points: m.points,
        currentStreak: m.profile.currentStreak,
      }));
  }
  // A migrated team with an empty player roster (e.g. post-rollover) is
  // genuinely empty — the legacy fallback is only for pre-backfill teams.
  if ((await prisma.membership.count({ where: { teamId } })) > 0) return [];
  const players = await prisma.user.findMany({
    where: { teamId, role: "PLAYER" },
    select: {
      id: true,
      name: true,
      profile: {
        select: {
          points: true,
          position: true,
          jerseyNumber: true,
          photoUrl: true,
          currentStreak: true,
        },
      },
    },
  });
  return players.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.profile?.position ?? null,
    jerseyNumber: p.profile?.jerseyNumber ?? null,
    photoUrl: p.profile?.photoUrl ?? null,
    points: p.profile?.points ?? 0,
    currentStreak: p.profile?.currentStreak ?? 0,
  }));
}

// The team at a glance: the active roster + today's check-in status, with the
// summary counts DERIVED from the same fetched sets. Ranks reuse getTeamRanking.
export async function getTeamOverview(teamId: number): Promise<TeamOverview> {
  const day = todayKey();
  const players = await activeRoster(teamId);
  const rosterIds = players.map((p) => p.id);
  const [todayEntries, todayQuestLogs, ranking] = await Promise.all([
    // status + time only — never the reflection text (content-free by
    // module contract). Keyed by the ROSTER's user ids, so a removed
    // player's activity never counts here.
    checkInTimesForUsers(rosterIds, day),
    prisma.questLog.findMany({
      where: { day, userId: { in: rosterIds } },
      select: { userId: true },
    }),
    getTeamRanking(teamId),
  ]);

  const checkedInAtByUser = new Map(todayEntries.map((e) => [e.userId, e.createdAt]));
  const rankById = new Map(ranking.map((r) => [r.id, r.rank]));

  const roster: RosterRow[] = players
    .map((p) => ({
      ...p,
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
  photoUrl: string | null;
  heightInches: number | null;
  pointsPerGame: number | null;
  reboundsPerGame: number | null;
  assistsPerGame: number | null;
  points: number;
  rank: number;
  total: number;
  checkedInAt: Date | null;
  mindsetTakeaway: string | null;
  // STATUS ONLY — the review's text is player-private (like the journal).
  reviewDoneToday: boolean;
  week: { checkins: number; questsDone: number; pointsEarned: number };
};

// Staff drill-in on ONE player. Returns null unless the target is a PLAYER
// with an ACTIVE membership on the CALLER's team (page redirects on null).
// "This week" = trailing 7 calendar days. NEVER reads reflection text.
// `includeTakeaway` = the caller's view_takeaways matrix result (GMs: false).
export async function getPlayerCoachView(
  coachTeamId: number,
  playerId: number,
  includeTakeaway = true,
): Promise<PlayerCoachView | null> {
  const target = await prisma.user.findUnique({
    where: { id: playerId },
    include: {
      profile: true,
      profileRecord: {
        select: {
          careerPoints: true,
          memberships: {
            where: { teamId: coachTeamId, endedAt: null },
            select: { id: true },
          },
        },
      },
    },
  });
  if (!target || target.role !== "PLAYER" || !target.profile) return null;
  // Roster truth = active membership (legacy teamId only pre-backfill).
  const onRoster = target.profileRecord
    ? target.profileRecord.memberships.length > 0
    : target.teamId === coachTeamId;
  if (!onRoster) return null;

  // Trailing 7 days (today + previous 6), local midnight.
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6);
  const weekStartKey = todayKey(weekStart);

  const [checkedInAt, todayTakeaway, reviewDone, checkins, questsDone, pointsAgg, ranking] =
    await Promise.all([
      // status/time only — no reflection (content-free by module contract)
      checkInTimeForPlayer(playerId, todayKey()),
      // Coach-visible BY DESIGN (unlike the private reflection) — but AT-TIME
      // scoped (4e): the stamp taken at write time decides which team's staff
      // may see it. An unstamped (pre-rebuild) row keeps legacy visibility.
      prisma.mindsetTakeaway.findUnique({
        where: { userId_day: { userId: playerId, day: todayKey() } },
        select: { text: true, membership: { select: { teamId: true } } },
      }),
      // Status only — never the review text (player-private by design).
      reviewDoneForPlayer(playerId, todayKey()),
      checkInCountForPlayer(playerId, weekStartKey),
      prisma.questLog.count({
        where: { userId: playerId, day: { gte: weekStartKey } },
      }),
      prisma.pointsLedger.aggregate({
        where: { userId: playerId, createdAt: { gte: weekStart } },
        _sum: { amount: true },
      }),
      getTeamRanking(coachTeamId),
    ]);

  const takeawayVisible =
    includeTakeaway &&
    todayTakeaway != null &&
    (todayTakeaway.membership == null || // unstamped → legacy visibility
      todayTakeaway.membership.teamId === coachTeamId); // at-time stamp

  const p = target.profile;
  return {
    id: target.id,
    name: target.name,
    position: p.position,
    jerseyNumber: p.jerseyNumber,
    photoUrl: p.photoUrl,
    heightInches: p.heightInches,
    pointsPerGame: p.pointsPerGame,
    reboundsPerGame: p.reboundsPerGame,
    assistsPerGame: p.assistsPerGame,
    // Card points/tier = CAREER (4d), equal to the legacy cache by invariant.
    points: target.profileRecord?.careerPoints ?? p.points,
    rank: ranking.findIndex((r) => r.id === playerId) >= 0
      ? ranking.find((r) => r.id === playerId)!.rank
      : 0,
    total: ranking.length,
    checkedInAt,
    mindsetTakeaway: takeawayVisible ? todayTakeaway.text : null,
    reviewDoneToday: reviewDone,
    week: {
      checkins,
      questsDone,
      pointsEarned: pointsAgg._sum.amount ?? 0,
    },
  };
}
