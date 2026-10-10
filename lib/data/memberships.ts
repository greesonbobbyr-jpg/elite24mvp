import { prisma } from "../prisma";

// ENDING A MEMBERSHIP — "removing a player ENDS A MEMBERSHIP, never deletes a
// User/Profile" (locked decision #2).
//
// This function touches EXACTLY TWO COLUMNS on EXACTLY ONE ROW: the active
// membership's endedAt + endedByProfileId. The User, Profile, ledger, journal, reviews, takeaways, streaks, careerPoints, and every OTHER
// membership are untouched — provable from the single updateMany below and
// asserted end-to-end by tests/roster.test.ts.
//
// Reversibility: nothing is lost. The athlete keeps their login and entire
// history. Re-joining the SAME team in the SAME season reactivates this exact
// membership (the @@unique([profileId, teamId, seasonId]) slot still exists,
// and its ledger rows still credit it — so the sum invariant REQUIRES
// reactivation, which also restores their team-board points). Joining a
// DIFFERENT team/season creates a fresh membership: career returns, board
// starts at 0.

export type EndMembershipResult =
  | { ok: true; membershipId: number }
  | { ok: false; reason: "no_active_membership" };

export async function endMembershipForUser(
  targetUserId: number,
  teamId: number,
  endedByProfileId: number | null,
): Promise<EndMembershipResult> {
  const membership = await prisma.membership.findFirst({
    where: { profile: { userId: targetUserId }, teamId, endedAt: null },
    select: { id: true },
  });
  if (!membership) return { ok: false, reason: "no_active_membership" };

  await prisma.membership.update({
    where: { id: membership.id },
    data: { endedAt: new Date(), endedByProfileId },
  });
  return { ok: true, membershipId: membership.id };
}
