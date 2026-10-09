import type { Ctx } from "./context";
import { can } from "./authz";
import { isStaffSide, personaOf } from "./persona";
import { prisma } from "./prisma";

// WHO MAY SEE A PERSON'S BRAND PAGE / PHOTO (hierarchy rebuild Stage 4b).
// Replaces the legacy `viewer.teamId === target.teamId` equality with
// org-bounded matrix checks:
//
//   "self"      the person themselves — full page + edit
//   "staff"     view_player_detail within the target's org (HEAD_COACH /
//               ASSISTANT_COACH / GENERAL_MANAGER on the target's team, or an
//               ORG_ADMIN of the org) — full read-only view
//   "teammate"  view_roster on the target's team (a PLAYER membership there) —
//               CARD INFO ONLY: no Dream, no per-game stats (the §2.10 ruling)
//   null        everyone else — including ALL of other organizations, always
//
// LEGACY FALLBACK (dies at Stage 6): when the viewer has no Profile yet or the
// target's team has no organization (rows the backfill hasn't reached), fall
// back to the exact legacy same-team check so the transition never locks out
// a legitimate viewer. The fallback can only ever apply the OLD, tighter
// same-team scope — it cannot widen access across orgs.

export type BrandAccess = "self" | "staff" | "teammate" | null;

export type BrandTarget = NonNullable<
  Awaited<ReturnType<typeof loadBrandTarget>>
>;

function loadBrandTarget(targetUserId: number) {
  return prisma.user.findUnique({
    where: { id: targetUserId },
    include: {
      profile: true,
      // The permanent Profile (careerPoints drives the card tier since 4d).
      profileRecord: { select: { careerPoints: true } },
      team: { include: { organization: true } },
    },
  });
}

export async function resolveBrandAccess(
  ctx: Ctx,
  targetUserId: number,
): Promise<{ target: BrandTarget; access: BrandAccess } | null> {
  const target = await loadBrandTarget(targetUserId);
  if (!target) return null;

  if (ctx.user.id === target.id) return { target, access: "self" };

  // No team (Personal Player Development): the card is the person's own.
  if (target.teamId == null) return { target, access: null };

  const targetOrgId = target.team?.organizationId ?? null;
  if (ctx.profile && targetOrgId != null) {
    const scope = { organizationId: targetOrgId, teamId: target.teamId };
    if (can(ctx, "view_player_detail", scope)) return { target, access: "staff" };
    if (can(ctx, "view_roster", scope)) return { target, access: "teammate" };
    return { target, access: null };
  }

  // Legacy fallback — same team only, exactly as before Stage 4b.
  if (ctx.user.teamId === target.teamId) {
    return { target, access: isStaffSide(personaOf(ctx)) ? "staff" : "teammate" };
  }
  return { target, access: null };
}
