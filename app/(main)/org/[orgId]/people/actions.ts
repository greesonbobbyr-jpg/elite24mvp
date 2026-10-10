"use server";

import { revalidatePath } from "next/cache";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/lib/context";
import { can } from "@/lib/authz";
import { loadOrgGroups, pathOf } from "@/lib/groups";
import { roleLabel } from "@/lib/format";

// CHANGE A MEMBER'S ROLE on a team (owner, 2026-10-09): a player becomes a
// coach ONLY when the organization promotes them — org admins, a group admin
// within their branch, or the CEO (change_member_role; head coaches can't).
// Player → staff needs the promoter to confirm the person is an adult, since
// staff can see players' emergency contacts. Recorded in Activity.

export type RoleState = { error?: string; ok?: boolean };

const ROLES: Role[] = ["PLAYER", "HEAD_COACH", "ASSISTANT_COACH", "GENERAL_MANAGER"];

export async function changeMemberRole(_p: RoleState, formData: FormData): Promise<RoleState> {
  const ctx = await getCurrentContext();
  const orgId = Number.parseInt(String(formData.get("orgId") ?? ""), 10);
  const membershipId = Number.parseInt(String(formData.get("membershipId") ?? ""), 10);
  const role = String(formData.get("role")) as Role;
  if (!ctx?.profile || !Number.isInteger(orgId) || !Number.isInteger(membershipId) || !ROLES.includes(role)) {
    return { error: "Pick a team and a role." };
  }
  const m = await prisma.membership.findUnique({
    where: { id: membershipId },
    select: {
      role: true,
      endedAt: true,
      profileId: true,
      profile: { select: { name: true, userId: true } },
      team: { select: { id: true, name: true, organizationId: true, groupId: true } },
    },
  });
  if (!m || m.endedAt || m.team.organizationId !== orgId) return { error: "That person isn't on this team anymore." };
  if (m.profileId === ctx.profile.id) return { error: "Someone else in the organization changes your own role." };
  const target = { organizationId: orgId, teamId: m.team.id, groupPath: pathOf(await loadOrgGroups(orgId), m.team.groupId) };
  if (!can(ctx, "change_member_role", target)) return { error: "You can't change roles on that team." };
  if (m.role === role) return { ok: true };
  const promotingToStaff = m.role === "PLAYER" && role !== "PLAYER";
  if (promotingToStaff && formData.get("adult") !== "on") {
    return { error: `Confirm ${m.profile.name.split(" ")[0]} is an adult (18+) first.` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.membership.update({ where: { id: membershipId }, data: { role } });
    const viaCeo = ctx.platformRole === "CEO" && !ctx.orgAdminOf.includes(orgId);
    await tx.auditEvent.create({
      data: {
        actorProfileId: ctx.profile!.id,
        action: viaCeo ? "ceo.org.change_role" : "org.change_role",
        organizationId: orgId,
        teamId: m.team.id,
        targetProfileId: m.profileId,
        detail: `${m.profile.name}: ${roleLabel(m.role) ?? "Player"} → ${roleLabel(role) ?? "Player"} · ${m.team.name}${promotingToStaff ? " (adult confirmed)" : ""}`,
      },
    });
  });
  revalidatePath(`/org/${orgId}`, "layout");
  return { ok: true };
}
