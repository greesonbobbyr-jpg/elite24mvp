import { prisma } from "./prisma";
import { todayKey, mondayOf, addDays, zonedStartOfDay } from "./daykey";

export type RankedPlayer = {
  id: number; // the player's login id (links, "YOU" checks)
  name: string;
  points: number;
  rank: number;
  jerseyNumber: number | null;
  position: string | null;
  photoUrl: string | null;
  /** Card cutout + its placement: the avatar sits on the card like the full card. */
  photoCutoutUrl: string | null;
  photoMeta: unknown;
  /** Career points: the card tier (the board ranks by team points). */
  careerPoints: number;
};

// The team's ACTIVE PLAYER memberships in the current season — the board
// roster. An ended membership drops off the board; its ledger
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
          photoCutoutUrl: true,
          photoMeta: true,
          careerPoints: true,
        },
      },
    },
  });
}

// Standard "competition" (1224) ranking: equal points share a rank, the next
// distinct score skips accordingly (two at 980 are both 3, the next is 5).
export function rank1224<T extends { points: number }>(sorted: T[]): (T & { rank: number })[] {
  let rank = 0;
  return sorted.map((p, i, arr) => {
    if (i === 0 || p.points !== arr[i - 1].points) rank = i + 1;
    return { ...p, rank };
  });
}

// Players on a team ranked by TEAM points (highest first) — Membership.points,
// the per-team cache, NOT career points. Shared by the leaderboard
// page and the brand page so the ranking lives in one place. Always called
// with a team the viewer belongs to — team-private (CLAUDE.md §3.2 / 3.5).
export async function getTeamRanking(teamId: number): Promise<RankedPlayer[]> {
  const memberships = await activePlayerMemberships(teamId);
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
      photoCutoutUrl: m.profile.photoCutoutUrl,
      photoMeta: m.profile.photoMeta,
      careerPoints: m.profile.careerPoints,
    }))
    .sort((a, b) => b.points - a.points);
  return rank1224(sorted);
}

export type WeeklyRankedPlayer = {
  id: number;
  name: string;
  photoUrl: string | null;
  /** The avatar's mini card: cutout, placement, number and tier. */
  photoCutoutUrl: string | null;
  photoMeta: unknown;
  jerseyNumber: number | null;
  careerPoints: number;
  weekPoints: number;
  lastWeekPoints: number;
  delta: number; // weekPoints - lastWeekPoints ("most improved" = max positive)
  rank: number;
};

// This week's points per player (Mon 12am → Sun in the app timezone), plus
// last week's for the "most improved vs. your own last week" delta. Summed by
// (membershipId, createdAt) — offseason rows (NULL membership) count toward
// career/tier but toward NO weekly board. Week boundaries are
// unchanged (mondayOf + zonedStartOfDay). Weekly reset keeps the bottom of the
// all-time board playing: everyone starts Monday at 0.
export async function getWeeklyRanking(
  teamId: number,
): Promise<WeeklyRankedPlayer[]> {
  const monday = mondayOf(todayKey());
  const weekStart = zonedStartOfDay(monday);
  const lastWeekStart = zonedStartOfDay(addDays(monday, -7));

  const memberships = await activePlayerMemberships(teamId);
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
        photoCutoutUrl: m.profile.photoCutoutUrl,
        photoMeta: m.profile.photoMeta,
        jerseyNumber: m.jerseyNumber ?? m.profile.jerseyNumber,
        careerPoints: m.profile.careerPoints,
        weekPoints,
        lastWeekPoints,
        delta: weekPoints - lastWeekPoints,
        points: weekPoints, // rank key
      };
    })
    .sort((a, b) => b.weekPoints - a.weekPoints);
  return rank1224(sorted).map(({ points: _rankKey, ...p }) => p);
}
