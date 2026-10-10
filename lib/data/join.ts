import { prisma } from "../prisma";

// JOINING A TEAM (hierarchy rebuild Stage 4f). A join code belongs to a TEAM
// and resolves into its org's CURRENT season. Two callers:
//   - the signup join flow (new login → new Profile → membership here), and
//   - the RETURNING ATHLETE (existing login, no active membership — removed
//     or season rolled over) joining from inside the app.
//
// Re-join semantics (proven at Stage 4e): the same team in the same season
// REACTIVATES the exact ended membership — its ledger rows still credit it,
// so the sum invariant demands it and the athlete's board points return (a
// mistaken removal fully undoes). A different team or a new season creates a
// FRESH membership: careerPoints/journal/streaks carry, that board starts 0.

export type JoinableTeam =
  | { ok: true; team: { id: number; name: string; organizationId: number }; seasonId: number }
  | { ok: false; reason: "bad_code" | "no_current_season" };

// Resolve a join code into a team + its current season. An org with no
// current season must FAIL joins with a clear "ask your coach" error
// (E.9 ruling) — never a silent skip.
export async function resolveJoinableTeam(code: string): Promise<JoinableTeam> {
  if (!code) return { ok: false, reason: "bad_code" };
  const team = await prisma.team.findUnique({
    where: { joinCode: code },
    select: {
      id: true,
      name: true,
      organizationId: true,
      organization: {
        select: { seasons: { where: { isCurrent: true }, select: { id: true }, take: 1 } },
      },
    },
  });
  if (!team) return { ok: false, reason: "bad_code" };
  const seasonId = team.organization?.seasons[0]?.id;
  if (team.organizationId == null || seasonId == null) {
    return { ok: false, reason: "no_current_season" };
  }
  return {
    ok: true,
    team: { id: team.id, name: team.name, organizationId: team.organizationId },
    seasonId,
  };
}

export type JoinResult = {
  membershipId: number;
  reactivated: boolean;
  alreadyActive: boolean;
};

// Put a profile on a team's roster for the given season — reactivate-or-
// create. One transaction.
export async function joinTeamForProfile(
  profileId: number,
  teamId: number,
  seasonId: number,
): Promise<JoinResult> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.membership.findUnique({
      where: { profileId_teamId_seasonId: { profileId, teamId, seasonId } },
    });

    let membershipId: number;
    let reactivated = false;
    let alreadyActive = false;
    if (existing) {
      membershipId = existing.id;
      if (existing.endedAt == null) {
        alreadyActive = true;
      } else {
        await tx.membership.update({
          where: { id: existing.id },
          data: { endedAt: null, endedByProfileId: null },
        });
        reactivated = true;
      }
    } else {
      const created = await tx.membership.create({
        data: { profileId, teamId, seasonId, role: "PLAYER" },
      });
      membershipId = created.id;
    }

    return { membershipId, reactivated, alreadyActive };
  });
}
