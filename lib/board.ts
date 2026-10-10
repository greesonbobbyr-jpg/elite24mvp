import { prisma } from "./prisma";

// Newest-N non-deleted messages for a team, returned oldest-first (chat order),
// with author, reactions, and — for replies — the quoted parent. Capped: a
// season of chat is thousands of rows, and the board used to fetch ALL of them
// on every visit. "Show earlier" grows the cap in steps. Always called with the
// current user's own teamId — team-private (CLAUDE.md section 3.2).
export const BOARD_PAGE_SIZE = 75;
export const BOARD_MAX_LIMIT = 600;

export async function listTeamMessages(
  teamId: number,
  limit: number = BOARD_PAGE_SIZE,
) {
  const take = Math.min(Math.max(limit, 1), BOARD_MAX_LIMIT);
  const newestFirst = await prisma.teamMessage.findMany({
    where: { teamId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      // The login that wrote it: its id for links and photo addresses.
      author: { select: { id: true, name: true } },
      // Display author: permanent Profile + role SNAPSHOT taken at write
      // time — a later role change never relabels old messages. The avatar
      // is the author's mini card: cutout, placement, number, level.
      authorProfile: {
        select: { name: true, photoUrl: true, photoCutoutUrl: true, photoMeta: true, jerseyNumber: true, careerPoints: true },
      },
      reactions: { select: { userId: true, reactionType: true } },
      replyTo: {
        select: {
          id: true,
          body: true,
          gifId: true,
          deletedAt: true,
          author: { select: { name: true } },
          authorProfile: { select: { name: true } },
        },
      },
    },
  });
  return newestFirst.reverse();
}
