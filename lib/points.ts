import { prisma } from "./prisma";

// Points awarded for completing a daily check-in.
export const POINTS_PER_CHECKIN = 10;

// Points awarded for completing the evening Pro Review.
export const POINTS_PER_REVIEW = 5;

// A player's points history, newest first (the PointsLedger is the source of
// truth). Private to that player — callers pass the current user's id.
export function listLedger(userId: number) {
  return prisma.pointsLedger.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

// The player's total points, read from the convenience cache on PlayerProfile
// (kept in sync with the ledger in the same transaction as each write).
export async function getPointsTotal(userId: number): Promise<number> {
  const profile = await prisma.playerProfile.findUnique({
    where: { userId },
    select: { points: true },
  });
  return profile?.points ?? 0;
}
