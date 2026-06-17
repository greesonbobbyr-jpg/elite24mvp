import { prisma } from "./prisma";

export type RankedPlayer = { id: number; name: string; points: number };

// Players on a team ranked by points (highest first). Shared by the leaderboard
// page and the brand page so the ranking lives in one place. Always called with
// the current user's own teamId — team-private (CLAUDE.md section 3.2 / 3.5).
export async function getTeamRanking(teamId: number): Promise<RankedPlayer[]> {
  const players = await prisma.user.findMany({
    where: { teamId, role: "PLAYER" },
    include: { profile: { select: { points: true } } },
  });
  return players
    .map((p) => ({ id: p.id, name: p.name, points: p.profile?.points ?? 0 }))
    .sort((a, b) => b.points - a.points);
}
