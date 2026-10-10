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

// The player's CAREER total — Profile.careerPoints (drives the card tier;
// crosses orgs by design: it's the athlete's own progression). Kept in sync
// with the ledger in the same transaction as each write.
export async function getPointsTotal(userId: number): Promise<number> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { careerPoints: true },
  });
  return profile?.careerPoints ?? 0;
}
