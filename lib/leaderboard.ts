import { prisma } from "./prisma";

export type RankedPlayer = {
  id: number;
  name: string;
  points: number;
  rank: number;
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
    include: { profile: { select: { points: true } } },
  });
  const sorted = players
    .map((p) => ({ id: p.id, name: p.name, points: p.profile?.points ?? 0 }))
    .sort((a, b) => b.points - a.points);

  let rank = 0;
  return sorted.map((p, i, arr) => {
    if (i === 0 || p.points !== arr[i - 1].points) rank = i + 1;
    return { ...p, rank };
  });
}
