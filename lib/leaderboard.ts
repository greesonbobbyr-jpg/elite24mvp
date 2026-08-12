import { prisma } from "./prisma";
import { todayKey, mondayOf, addDays, zonedStartOfDay } from "./daykey";

export type RankedPlayer = {
  id: number; // the player's USER id (links, "YOU" checks) — until Stage 6
  name: string;
  points: number;
  rank: number;
  jerseyNumber: number | null;
  position: string | null;
  photoUrl: string | null;
};

// The team's ACTIVE PLAYER memberships in the current season — the board
// roster since Stage 4d. An ended membership drops off the board; its ledger
// rows and the athlete's careerPoints are untouched (proven by test).
async function activePlayerMemberships(teamId: number) {
  return prisma.membership.findMany({
    where: { teamId, role: "PLAYER", endedAt: null, season: { isCurrent: true } },
    include: {
      profile: {
        select: {
          id: true,
          userId: true,
          name: true,
          jerseyNumber: true,
          position: true,
          photoUrl: true,
        },
      },
    },
  });
}

// The legacy fallback applies ONLY to a team the backfill never reached (no
// memberships of any kind, ever). A migrated team with an empty player roster
// — e.g. right after a season rollover — shows a genuinely EMPTY board, not
// the resurrected legacy user list. (Caught by the 4f rollover test.)
async function isPreBackfillTeam(teamId: number) {
  return (await prisma.membership.count({ where: { teamId } })) === 0;
}

// Standard "competition" (1224) ranking: equal points share a rank, the next
// distinct score skips accordingly (two at 980 are both 3, the next is 5).
function rank1224<T extends { points: number }>(sorted: T[]): (T & { rank: number })[] {
  let rank = 0;
  return sorted.map((p, i, arr) => {
    if (i === 0 || p.points !== arr[i - 1].points) rank = i + 1;
    return { ...p, rank };
  });
}

// Players on a team ranked by TEAM points (highest first) — Membership.points,
// the per-team cache, NOT career points (Stage 4d). Shared by the leaderboard
// page and the brand page so the ranking lives in one place. Always called
// with a team the viewer belongs to — team-private (CLAUDE.md §3.2 / 3.5).
export async function getTeamRanking(teamId: number): Promise<RankedPlayer[]> {
  const memberships = await activePlayerMemberships(teamId);

  if (memberships.length > 0) {
    const sorted = memberships
      // A profile with no login can't be linked/rendered — skip (rare orphan).
      .filter((m) => m.profile.userId != null)
      .map((m) => ({
        id: m.profile.userId!,
        name: m.profile.name,
        points: m.points,
        // Per-team jersey override wins over the profile default.
        jerseyNumber: m.jerseyNumber ?? m.profile.jerseyNumber,
        position: m.profile.position,
        photoUrl: m.profile.photoUrl,
      }))
      .sort((a, b) => b.points - a.points);
    return rank1224(sorted);
  }
  if (!(await isPreBackfillTeam(teamId))) return []; // migrated + empty roster

  // LEGACY FALLBACK (pre-backfill team — dies at Stage 6).
  const players = await prisma.user.findMany({
    where: { teamId, role: "PLAYER" },
    include: {
      profile: {
        select: { points: true, jerseyNumber: true, position: true, photoUrl: true },
      },
    },
  });
  const sorted = players
    .map((p) => ({
      id: p.id,
      name: p.name,
      points: p.profile?.points ?? 0,
      jerseyNumber: p.profile?.jerseyNumber ?? null,
      position: p.profile?.position ?? null,
      photoUrl: p.profile?.photoUrl ?? null,
    }))
    .sort((a, b) => b.points - a.points);
  return rank1224(sorted);
}

export type WeeklyRankedPlayer = {
  id: number;
  name: string;
  photoUrl: string | null;
  weekPoints: number;
  lastWeekPoints: number;
  delta: number; // weekPoints - lastWeekPoints ("most improved" = max positive)
  rank: number;
};

// This week's points per player (Mon 12am → Sun in the app timezone), plus
// last week's for the "most improved vs. your own last week" delta. Summed by
// (membershipId, createdAt) since Stage 4d — offseason rows (NULL membership)
// count toward career/tier but toward NO weekly board. Week boundaries are
// unchanged (mondayOf + zonedStartOfDay). Weekly reset keeps the bottom of the
// all-time board playing: everyone starts Monday at 0.
export async function getWeeklyRanking(
  teamId: number,
): Promise<WeeklyRankedPlayer[]> {
  const monday = mondayOf(todayKey());
  const weekStart = zonedStartOfDay(monday);
  const lastWeekStart = zonedStartOfDay(addDays(monday, -7));

  const memberships = await activePlayerMemberships(teamId);

  if (memberships.length > 0) {
    const ids = memberships.map((m) => m.id);
    const [thisWeek, lastWeek] = await Promise.all([
      prisma.pointsLedger.groupBy({
        by: ["membershipId"],
        where: { membershipId: { in: ids }, createdAt: { gte: weekStart } },
        _sum: { amount: true },
      }),
      prisma.pointsLedger.groupBy({
        by: ["membershipId"],
        where: {
          membershipId: { in: ids },
          createdAt: { gte: lastWeekStart, lt: weekStart },
        },
        _sum: { amount: true },
      }),
    ]);
    const thisBy = new Map(thisWeek.map((r) => [r.membershipId, r._sum.amount ?? 0]));
    const lastBy = new Map(lastWeek.map((r) => [r.membershipId, r._sum.amount ?? 0]));

    const sorted = memberships
      .filter((m) => m.profile.userId != null)
      .map((m) => {
        const weekPoints = thisBy.get(m.id) ?? 0;
        const lastWeekPoints = lastBy.get(m.id) ?? 0;
        return {
          id: m.profile.userId!,
          name: m.profile.name,
          photoUrl: m.profile.photoUrl,
          weekPoints,
          lastWeekPoints,
          delta: weekPoints - lastWeekPoints,
          points: weekPoints, // rank key
        };
      })
      .sort((a, b) => b.weekPoints - a.weekPoints);
    return rank1224(sorted).map(({ points: _rankKey, ...p }) => p);
  }
  if (!(await isPreBackfillTeam(teamId))) return []; // migrated + empty roster

  // LEGACY FALLBACK (pre-backfill team — dies at Stage 6).
  const [players, thisWeek, lastWeek] = await Promise.all([
    prisma.user.findMany({
      where: { teamId, role: "PLAYER" },
      select: { id: true, name: true, profile: { select: { photoUrl: true } } },
    }),
    prisma.pointsLedger.groupBy({
      by: ["userId"],
      where: { user: { teamId, role: "PLAYER" }, createdAt: { gte: weekStart } },
      _sum: { amount: true },
    }),
    prisma.pointsLedger.groupBy({
      by: ["userId"],
      where: {
        user: { teamId, role: "PLAYER" },
        createdAt: { gte: lastWeekStart, lt: weekStart },
      },
      _sum: { amount: true },
    }),
  ]);
  const thisByUser = new Map(thisWeek.map((r) => [r.userId, r._sum.amount ?? 0]));
  const lastByUser = new Map(lastWeek.map((r) => [r.userId, r._sum.amount ?? 0]));
  const sorted = players
    .map((p) => {
      const weekPoints = thisByUser.get(p.id) ?? 0;
      const lastWeekPoints = lastByUser.get(p.id) ?? 0;
      return {
        id: p.id,
        name: p.name,
        photoUrl: p.profile?.photoUrl ?? null,
        weekPoints,
        lastWeekPoints,
        delta: weekPoints - lastWeekPoints,
        points: weekPoints,
      };
    })
    .sort((a, b) => b.weekPoints - a.weekPoints);
  return rank1224(sorted).map(({ points: _rankKey, ...p }) => p);
}
