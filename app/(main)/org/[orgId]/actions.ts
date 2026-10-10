"use server";

import { revalidatePath } from "next/cache";
import type { GroupKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentContext, type Ctx } from "@/lib/context";
import { canAddUnder, canMove, depthsAfterMove, GROUP_KINDS, groupLabel, loadOrgGroups, type GroupRow } from "@/lib/groups";
import { canShapeAt, orgAccessFor, type OrgAccess } from "@/lib/orgaccess";
import { choiceFromForm, templateGroups, type TemplateNode } from "@/lib/structure-templates";
import { uniqueJoinCode } from "@/lib/joincode";

// ORGANIZATION VIEW · STRUCTURE ACTIONS (person-first plan Phase 2). Every
// action re-resolves who is asking (lib/orgaccess) and the org's groups from
// the database; form ids are never trusted — a group or team must belong to
// THIS organization, and a group admin may only shape things inside their
// branch. Every change is recorded in the org's Activity.

export type ShapeState = { error?: string; ok?: boolean };

type Shaper = { ctx: Ctx; access: OrgAccess; groups: GroupRow[] };

const int = (v: FormDataEntryValue | null) => {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isInteger(n) ? n : null;
};
const cleanName = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s.length >= 1 && s.length <= 40 ? s : null;
};
const kindOf = (v: FormDataEntryValue | null): GroupKind =>
  GROUP_KINDS.includes(String(v) as GroupKind) ? (String(v) as GroupKind) : "CUSTOM";

async function shaper(formData: FormData): Promise<Shaper | null> {
  const orgId = int(formData.get("orgId"));
  if (orgId == null) return null;
  const ctx = await getCurrentContext();
  const access = orgAccessFor(ctx, orgId);
  if (!ctx || !access) return null;
  return { ctx, access, groups: await loadOrgGroups(orgId) };
}

const may = (s: Shaper, groupId: number | null) => canShapeAt(s.ctx, s.access, s.groups, groupId);
const groupIn = (s: Shaper, id: number | null) => (id == null ? null : (s.groups.find((g) => g.id === id) ?? null));

async function done(s: Shaper, action: string, detail: string): Promise<ShapeState> {
  await prisma.auditEvent.create({
    data: {
      actorProfileId: s.access.profileId,
      action: s.access.via === "ceo" ? `ceo.${action}` : action,
      organizationId: s.access.orgId,
      detail,
    },
  });
  revalidatePath(`/org/${s.access.orgId}`, "layout");
  return { ok: true };
}

const DENIED = { error: "You can't change that part of the organization." };
const nextSort = (s: Shaper, parentId: number | null) =>
  s.groups.filter((g) => g.parentId === parentId).reduce((m, g) => Math.max(m, g.sortOrder), -1) + 1;

export async function addGroup(_p: ShapeState, formData: FormData): Promise<ShapeState> {
  const s = await shaper(formData);
  if (!s) return DENIED;
  const parentId = int(formData.get("parentId"));
  if (parentId != null && !groupIn(s, parentId)) return DENIED;
  if (!may(s, parentId)) return DENIED;
  const name = cleanName(formData.get("name"));
  if (!name) return { error: "Name the group (1–40 characters)." };
  const placed = canAddUnder(s.groups, parentId);
  if (!placed.ok) return { error: placed.error };
  await prisma.group.create({
    data: {
      organizationId: s.access.orgId,
      parentId,
      name,
      kind: kindOf(formData.get("kind")),
      depth: placed.depth,
      sortOrder: nextSort(s, parentId),
    },
  });
  return done(s, "org.add_group", parentId == null ? name : `${groupLabel(s.groups, parentId)} · ${name}`);
}

export async function editGroup(_p: ShapeState, formData: FormData): Promise<ShapeState> {
  const s = await shaper(formData);
  const g = s && groupIn(s, int(formData.get("groupId")));
  // Editing a group is a change at its PLACE (its parent).
  if (!s || !g || !may(s, g.parentId)) return DENIED;
  const name = cleanName(formData.get("name"));
  if (!name) return { error: "Name the group (1–40 characters)." };
  await prisma.group.update({ where: { id: g.id }, data: { name, kind: kindOf(formData.get("kind")) } });
  return done(s, "org.edit_group", g.name === name ? name : `${g.name} → ${name}`);
}

export async function reorderGroup(formData: FormData): Promise<void> {
  const s = await shaper(formData);
  const g = s && groupIn(s, int(formData.get("groupId")));
  if (!s || !g || !may(s, g.parentId)) return;
  const siblings = s.groups.filter((x) => x.parentId === g.parentId).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const i = siblings.findIndex((x) => x.id === g.id);
  const j = i + (String(formData.get("direction")) === "up" ? -1 : 1);
  if (i < 0 || j < 0 || j >= siblings.length) return;
  [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
  await prisma.$transaction(siblings.map((x, idx) => prisma.group.update({ where: { id: x.id }, data: { sortOrder: idx } })));
  await done(s, "org.reorder_group", g.name);
}

export async function moveGroup(_p: ShapeState, formData: FormData): Promise<ShapeState> {
  const s = await shaper(formData);
  const g = s && groupIn(s, int(formData.get("groupId")));
  if (!s || !g || !may(s, g.parentId)) return DENIED;
  const to = int(formData.get("parentId"));
  if (to != null && !groupIn(s, to)) return DENIED;
  if (!may(s, to)) return DENIED;
  if (to === g.parentId) return { ok: true };
  const check = canMove(s.groups, g.id, to);
  if (!check.ok) return { error: check.error };
  const depths = depthsAfterMove(s.groups, g.id, check.depth);
  await prisma.$transaction([
    prisma.group.update({ where: { id: g.id }, data: { parentId: to, sortOrder: nextSort(s, to) } }),
    ...[...depths].map(([id, depth]) => prisma.group.update({ where: { id }, data: { depth } })),
  ]);
  return done(s, "org.move_group", `${g.name} → ${to == null ? "top level" : groupLabel(s.groups, to)}`);
}

export async function deleteGroup(_p: ShapeState, formData: FormData): Promise<ShapeState> {
  const s = await shaper(formData);
  const g = s && groupIn(s, int(formData.get("groupId")));
  if (!s || !g || !may(s, g.parentId)) return DENIED;
  if (s.groups.some((x) => x.parentId === g.id)) return { error: "Move or delete the groups inside it first." };
  if (await prisma.team.count({ where: { groupId: g.id } })) return { error: "Move its teams somewhere else first." };
  if (await prisma.roleAssignment.count({ where: { groupId: g.id, revokedAt: null } })) {
    return { error: "Remove its group admin first." };
  }
  await prisma.$transaction([
    // Ended grants only point at it; the Activity log keeps the record.
    prisma.roleAssignment.deleteMany({ where: { groupId: g.id, revokedAt: { not: null } } }),
    prisma.group.delete({ where: { id: g.id } }),
  ]);
  return done(s, "org.delete_group", g.name);
}

export async function addTeam(_p: ShapeState, formData: FormData): Promise<ShapeState> {
  const s = await shaper(formData);
  if (!s) return DENIED;
  const groupId = int(formData.get("groupId"));
  if (groupId != null && !groupIn(s, groupId)) return DENIED;
  if (!may(s, groupId)) return DENIED;
  const name = cleanName(formData.get("name"));
  if (!name) return { error: "Name the team (1–40 characters)." };
  await prisma.team.create({
    data: { name, organizationId: s.access.orgId, groupId, joinCode: await uniqueJoinCode() },
  });
  return done(s, "org.add_team", groupId == null ? name : `${groupLabel(s.groups, groupId)} · ${name}`);
}

export async function moveTeam(_p: ShapeState, formData: FormData): Promise<ShapeState> {
  const s = await shaper(formData);
  const teamId = int(formData.get("teamId"));
  if (!s || teamId == null) return DENIED;
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { name: true, organizationId: true, groupId: true } });
  if (!team || team.organizationId !== s.access.orgId) return DENIED;
  const to = int(formData.get("groupId"));
  if (to != null && !groupIn(s, to)) return DENIED;
  // Out of where it is, into where it goes — both inside their reach.
  if (!may(s, team.groupId) || !may(s, to)) return DENIED;
  if (to === team.groupId) return { ok: true };
  await prisma.team.update({ where: { id: teamId }, data: { groupId: to } });
  return done(s, "org.move_team", `${team.name} → ${to == null ? "top level" : groupLabel(s.groups, to)}`);
}

// START FROM A SHAPE — only while the org has no groups at all, and only
// for whoever shapes the whole org (not a group admin).
export async function applyTemplate(_p: ShapeState, formData: FormData): Promise<ShapeState> {
  const s = await shaper(formData);
  if (!s || !may(s, null)) return DENIED;
  if (s.groups.length > 0) return { error: "This organization already has groups — change them below." };
  const choice = choiceFromForm(formData);
  if (!choice) return { error: "Pick a shape." };
  const result = templateGroups(choice);
  if (!result.ok) return { error: result.error };

  const orgId = s.access.orgId;
  await prisma.$transaction(async (tx) => {
    const create = async (nodes: TemplateNode[], parentId: number | null, depth: number) => {
      for (const [sortOrder, node] of nodes.entries()) {
        const g = await tx.group.create({
          data: { organizationId: orgId, parentId, name: node.name, kind: node.kind, depth, sortOrder },
        });
        await create(node.children ?? [], g.id, depth + 1);
      }
    };
    await create(result.groups, null, 1);
  });
  return done(s, "org.apply_template", choice.template);
}

// GROUP ADMINS — set by whoever shapes the whole org. The person must already
// be staff in this organization (adults the org has vetted as coaches).
export async function addGroupAdmin(_p: ShapeState, formData: FormData): Promise<ShapeState> {
  const s = await shaper(formData);
  if (!s || !may(s, null)) return DENIED;
  const g = groupIn(s, int(formData.get("groupId")));
  const profileId = int(formData.get("profileId"));
  if (!g || profileId == null) return { error: "Pick a person." };
  const staff = await prisma.membership.findFirst({
    where: {
      profileId,
      role: { not: "PLAYER" },
      endedAt: null,
      season: { isCurrent: true },
      team: { organizationId: s.access.orgId },
    },
    select: { profile: { select: { name: true } } },
  });
  if (!staff) return { error: "Group admins must be staff in this organization." };
  const existing = await prisma.roleAssignment.findFirst({
    where: { profileId, role: "GROUP_ADMIN", groupId: g.id, revokedAt: null },
  });
  if (existing) return { ok: true };
  await prisma.roleAssignment.create({
    data: { profileId, role: "GROUP_ADMIN", organizationId: s.access.orgId, groupId: g.id },
  });
  return done(s, "org.add_group_admin", `${staff.profile.name} · ${groupLabel(s.groups, g.id)}`);
}

export async function removeGroupAdmin(_p: ShapeState, formData: FormData): Promise<ShapeState> {
  const s = await shaper(formData);
  if (!s || !may(s, null)) return DENIED;
  const grantId = int(formData.get("grantId"));
  if (grantId == null) return DENIED;
  const grant = await prisma.roleAssignment.findUnique({
    where: { id: grantId },
    select: { organizationId: true, role: true, groupId: true, revokedAt: true, profile: { select: { name: true } } },
  });
  if (!grant || grant.organizationId !== s.access.orgId || grant.role !== "GROUP_ADMIN" || grant.revokedAt) return DENIED;
  await prisma.roleAssignment.update({ where: { id: grantId }, data: { revokedAt: new Date() } });
  return done(s, "org.remove_group_admin", `${grant.profile.name} · ${grant.groupId ? groupLabel(s.groups, grant.groupId) : ""}`);
}
