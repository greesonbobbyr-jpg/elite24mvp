"use server";

import { revalidatePath } from "next/cache";
import { shareable, type MadeInvite } from "@/lib/invite-share";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/lib/context";
import { loadOrgGroups, pathOf } from "@/lib/groups";
import { createInvite, type InviteRole } from "@/lib/invites";
import { mayInviteRole } from "@/lib/orgaccess";
import { roleLabel } from "@/lib/format";
import { rateLimit, RATE_LIMITED_MESSAGE } from "@/lib/ratelimit";

// MAKING AND CANCELLING INVITES (person-first plan Phase 3). Staff invites
// come from Organization View, a head coach's Team settings, or the CEO;
// org codes come from the CEO only. Every check runs here, from a fresh
// context — the form only says what was asked for.

export type InviteFormState = { error?: string; made?: MadeInvite };

const int = (v: FormDataEntryValue | null) => {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isInteger(n) ? n : null;
};

const INVITE_ROLES: InviteRole[] = ["HEAD_COACH", "ASSISTANT_COACH", "GENERAL_MANAGER", "ORG_ADMIN"];

export async function createStaffInvite(_p: InviteFormState, formData: FormData): Promise<InviteFormState> {
  const ctx = await getCurrentContext();
  const orgId = int(formData.get("orgId"));
  const role = String(formData.get("role")) as InviteRole;
  if (!ctx?.profile || orgId == null || !INVITE_ROLES.includes(role)) return { error: "Pick a role." };
  if (!(await rateLimit("invite-create", String(ctx.profile.id), 30, 3600))) return { error: RATE_LIMITED_MESSAGE };

  const teamId = role === "ORG_ADMIN" ? null : int(formData.get("teamId"));
  let team: { id: number; name: string; groupPath: number[] } | null = null;
  if (teamId != null) {
    const row = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, name: true, organizationId: true, groupId: true } });
    if (!row || row.organizationId !== orgId) return { error: "Pick a team in this organization." };
    team = { id: row.id, name: row.name, groupPath: pathOf(await loadOrgGroups(orgId), row.groupId) };
  } else if (role !== "ORG_ADMIN") {
    return { error: "Pick a team." };
  }
  if (!mayInviteRole(ctx, orgId, team, role)) return { error: "You can't invite that role here." };

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
  const { code, token } = await createInvite({
    kind: "STAFF",
    role,
    organizationId: orgId,
    teamId: team?.id ?? null,
    label: String(formData.get("label") ?? ""),
    createdByProfileId: ctx.profile.id,
  });
  const what = `${roleLabel(role)} · ${team?.name ?? org?.name ?? "the organization"}`;
  const viaCeo = ctx.platformRole === "CEO" && !ctx.orgAdminOf.includes(orgId);
  await prisma.auditEvent.create({
    data: { actorProfileId: ctx.profile.id, action: viaCeo ? "ceo.invite.created" : "invite.created", organizationId: orgId, teamId: team?.id ?? null, detail: what },
  });
  revalidatePath(`/org/${orgId}/invites`);
  return { made: await shareable(code, token, what, 7) };
}

export async function revokeStaffInvite(formData: FormData): Promise<void> {
  const ctx = await getCurrentContext();
  const id = int(formData.get("inviteId"));
  if (!ctx?.profile || id == null) return;
  const invite = await prisma.invite.findUnique({ where: { id } });
  if (!invite || invite.kind !== "STAFF" || invite.organizationId == null || !invite.role || invite.revokedAt || invite.usedAt) return;
  const orgId = invite.organizationId;
  let team: { id: number; groupPath: number[] } | null = null;
  if (invite.teamId != null) {
    const row = await prisma.team.findUnique({ where: { id: invite.teamId }, select: { groupId: true } });
    team = { id: invite.teamId, groupPath: pathOf(await loadOrgGroups(orgId), row?.groupId ?? null) };
  }
  // Whoever could make this invite may cancel it.
  if (!mayInviteRole(ctx, orgId, team, invite.role as InviteRole)) return;
  await prisma.invite.update({ where: { id }, data: { revokedAt: new Date() } });
  await prisma.auditEvent.create({
    data: { actorProfileId: ctx.profile.id, action: "invite.revoked", organizationId: orgId, teamId: invite.teamId, detail: invite.codeHint },
  });
  revalidatePath(`/org/${orgId}/invites`);
  revalidatePath("/team");
}

// ORG CODES — the CEO only.
export async function createOrgCode(_p: InviteFormState, formData: FormData): Promise<InviteFormState> {
  const ctx = await getCurrentContext();
  if (!ctx?.profile || ctx.platformRole !== "CEO") return { error: "Only the CEO can make organization codes." };
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Say who it's for (the organization or person)." };
  const { code, token } = await createInvite({ kind: "ORG_CREATE", label, createdByProfileId: ctx.profile.id });
  await prisma.auditEvent.create({ data: { actorProfileId: ctx.profile.id, action: "ceo.org_code.created", detail: label } });
  revalidatePath("/ceo/codes");
  return { made: await shareable(code, token, `Start an organization · for ${label}`, 30) };
}

export async function revokeOrgCode(formData: FormData): Promise<void> {
  const ctx = await getCurrentContext();
  const id = int(formData.get("inviteId"));
  if (!ctx?.profile || ctx.platformRole !== "CEO" || id == null) return;
  const invite = await prisma.invite.findUnique({ where: { id } });
  if (!invite || invite.kind !== "ORG_CREATE" || invite.revokedAt || invite.usedAt) return;
  await prisma.invite.update({ where: { id }, data: { revokedAt: new Date() } });
  await prisma.auditEvent.create({ data: { actorProfileId: ctx.profile.id, action: "ceo.org_code.revoked", detail: invite.label ?? invite.codeHint } });
  revalidatePath("/ceo/codes");
}
