import { prisma } from "./prisma";
import { todayKey, mondayOf, addDays, zonedStartOfDay } from "./daykey";

export type RankedPlayer = {
  id: number;
  name: string;
  points: number;
  rank: number;
  jerseyNumber: number | null;
  position: string | null;
  photoUrl: string | null;
};

// Players on a team ranked by points (highest first). Shared by the leaderboard
// page and the brand page so the ranking lives in one place. Always called with
// the current user's own teamId — team-private (CLAUDE.md section 3.2 / 3.5).
//
// `rank` uses standard "competition" (1224) ranking: players with equal points
// share the same rank, and the next distinct score skips accordingly (e.g. two
// players at 980 are both rank 3, the next is rank 5).
export async function getTeamRanking(teamId: number): Promise<RankedPlayer[]> {
  const players = await prisma.user.findMany({
    where: { teamId, role: "PLAYER" },
    include: {
      profile: {
        select: {
          points: true,
          jerseyNumber: true,
          position: true,
          photoUrl: true,
        },
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

  let rank = 0;
  return sorted.map((p, i, arr) => {
    if (i === 0 || p.points !== arr[i - 1].points) rank = i + 1;
    return { ...p, rank };
  });
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

// This week's points per player (Mon–Sun in the app timezone), plus last week's
// for the "most improved vs. your own last week" delta. Derived entirely from
// PointsLedger.createdAt — no schema. A weekly-reset board keeps the bottom of
// the all-time board playing: everyone starts Monday at 0.
export async function getWeeklyRanking(
  teamId: number,
): Promise<WeeklyRankedPlayer[]> {
  const monday = mondayOf(todayKey());
  const weekStart = zonedStartOfDay(monday);
  const lastWeekStart = zonedStartOfDay(addDays(monday, -7));

  const [players, thisWeek, lastWeek] = await Promise.all([
    prisma.user.findMany({
      where: { teamId, role: "PLAYER" },
      select: {
        id: true,
        name: true,
        profile: { select: { photoUrl: true } },
      },
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
      };
    })
    .sort((a, b) => b.weekPoints - a.weekPoints);

  let rank = 0;
  return sorted.map((p, i, arr) => {
    if (i === 0 || p.weekPoints !== arr[i - 1].weekPoints) rank = i + 1;
    return { ...p, rank };
  });
}
