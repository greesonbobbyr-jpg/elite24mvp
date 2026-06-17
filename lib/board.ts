import { prisma } from "./prisma";

// Non-deleted messages for a team, oldest first (chat order). Always called with
// the current user's own teamId — team-private (CLAUDE.md section 3.2).
export function listTeamMessages(teamId: number) {
  return prisma.teamMessage.findMany({
    where: { teamId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, role: true } } },
  });
}
