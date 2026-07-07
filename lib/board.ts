import { prisma } from "./prisma";

// Non-deleted messages for a team, oldest first (chat order), with author,
// reactions, and — for replies — the quoted parent (author name + a snippet of
// its body/gif, plus its deletedAt so a removed parent renders "original
// removed"). Always called with the current user's own teamId — team-private
// (CLAUDE.md section 3.2).
export function listTeamMessages(teamId: number) {
  return prisma.teamMessage.findMany({
    where: { teamId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          role: true,
          profile: { select: { photoUrl: true } },
        },
      },
      reactions: { select: { userId: true, reactionType: true } },
      replyTo: {
        select: {
          id: true,
          body: true,
          gifId: true,
          deletedAt: true,
          author: { select: { name: true } },
        },
      },
    },
  });
}
