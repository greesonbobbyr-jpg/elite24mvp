import type { GroupKind } from "@prisma/client";
import { prisma } from "./prisma";
import { MAX_GROUP_DEPTH } from "./group-limits";

// THE GROUP TREE (person-first plan Phase 2, owner 2026-10-09) — replaces
// lib/structure's fixed Program → Division layers. An organization shapes its
// own tree: Boys/Girls, age groups, Junior High/JV/Varsity, schools in a
// district — up to MAX_GROUP_DEPTH levels, teams at any level (a team with no
// group sits directly under the organization).
//
// Loaded in ONE query per org (loadOrgGroups); everything else here is pure,
// so tests drive it without a database. The tree is for display and rollups,
// and it is the reach of a GROUP_ADMIN grant (lib/authz, via groupPath).

export { MAX_GROUP_DEPTH };

// How each kind reads on a chip. Kinds only label a group — no rule depends
// on them (an org can nest them any way that matches how it runs).
export const GROUP_KIND_LABEL: Record<GroupKind, string> = {
  PROGRAM: "Program",
  GENDER: "Boys or Girls",
  AGE_GROUP: "Age group",
  LEVEL: "Level",
  SCHOOL: "School",
  DIVISION: "Division",
  CUSTOM: "Group",
};
export const GROUP_KINDS = Object.keys(GROUP_KIND_LABEL) as GroupKind[];

export type GroupRow = {
  id: number;
  parentId: number | null;
  name: string;
  kind: GroupKind;
  sortOrder: number;
  depth: number;
};

export async function loadOrgGroups(organizationId: number): Promise<GroupRow[]> {
  return prisma.group.findMany({
    where: { organizationId },
    orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, parentId: true, name: true, kind: true, sortOrder: true, depth: true },
  });
}

/** Sibling order: sortOrder, then id (seeded or backfilled rows may share 0). */
export const bySortOrder = (a: GroupRow, b: GroupRow) => a.sortOrder - b.sortOrder || a.id - b.id;

/** Children of each parent (null = the organization's top level), in order. */
export function childrenByParent(groups: readonly GroupRow[]): Map<number | null, GroupRow[]> {
  const map = new Map<number | null, GroupRow[]>();
  for (const g of groups) {
    const list = map.get(g.parentId) ?? [];
    list.push(g);
    map.set(g.parentId, list);
  }
  for (const list of map.values()) list.sort(bySortOrder);
  return map;
}

/** The ids from the top level down to `groupId` itself; [] for null. A broken
 * parent chain (a cycle, a missing row) stops rather than loops. */
export function pathOf(groups: readonly GroupRow[], groupId: number | null): number[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const path: number[] = [];
  let current = groupId == null ? undefined : byId.get(groupId);
  while (current && !path.includes(current.id)) {
    path.unshift(current.id);
    current = current.parentId == null ? undefined : byId.get(current.parentId);
  }
  return path;
}

/** Every group under `groupId` (not itself), any depth. */
export function descendantsOf(groups: readonly GroupRow[], groupId: number): number[] {
  const children = childrenByParent(groups);
  const out: number[] = [];
  const stack = [...(children.get(groupId) ?? [])];
  while (stack.length > 0) {
    const g = stack.pop()!;
    if (out.includes(g.id)) continue;
    out.push(g.id);
    stack.push(...(children.get(g.id) ?? []));
  }
  return out;
}

/** Levels in the subtree rooted at `groupId`, counting itself (a leaf is 1). */
export function subtreeHeight(groups: readonly GroupRow[], groupId: number): number {
  const children = childrenByParent(groups);
  const height = (id: number, seen: Set<number>): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    const kids = children.get(id) ?? [];
    return 1 + (kids.length ? Math.max(...kids.map((k) => height(k.id, seen))) : 0);
  };
  return height(groupId, new Set());
}

/** Can a new group go under `parentId` (null = top level)? */
export function canAddUnder(
  groups: readonly GroupRow[],
  parentId: number | null,
): { ok: true; depth: number } | { ok: false; error: string } {
  if (parentId == null) return { ok: true, depth: 1 };
  const parent = groups.find((g) => g.id === parentId);
  if (!parent) return { ok: false, error: "That group isn't in this organization." };
  if (parent.depth >= MAX_GROUP_DEPTH) {
    return { ok: false, error: `Groups go at most ${MAX_GROUP_DEPTH} levels deep.` };
  }
  return { ok: true, depth: parent.depth + 1 };
}

/** Can `groupId` (with everything under it) move under `newParentId`? Never
 * under itself or its own descendants; never deeper than MAX_GROUP_DEPTH. */
export function canMove(
  groups: readonly GroupRow[],
  groupId: number,
  newParentId: number | null,
): { ok: true; depth: number } | { ok: false; error: string } {
  if (!groups.some((g) => g.id === groupId)) return { ok: false, error: "That group isn't in this organization." };
  if (newParentId === groupId || (newParentId != null && descendantsOf(groups, groupId).includes(newParentId))) {
    return { ok: false, error: "A group can't go inside itself." };
  }
  const placed = canAddUnder(groups, newParentId);
  if (!placed.ok) return placed;
  if (placed.depth + subtreeHeight(groups, groupId) - 1 > MAX_GROUP_DEPTH) {
    return { ok: false, error: `That would make it more than ${MAX_GROUP_DEPTH} levels deep.` };
  }
  return { ok: true, depth: placed.depth };
}

/** The new depth of a moved group and everything under it. */
export function depthsAfterMove(
  groups: readonly GroupRow[],
  groupId: number,
  newDepth: number,
): Map<number, number> {
  const children = childrenByParent(groups);
  const depths = new Map<number, number>();
  const walk = (id: number, depth: number) => {
    if (depths.has(id)) return;
    depths.set(id, depth);
    for (const k of children.get(id) ?? []) walk(k.id, depth + 1);
  };
  walk(groupId, newDepth);
  return depths;
}

/** A group's name with its parents', for pickers: "Girls · 15U". */
export function groupLabel(groups: readonly GroupRow[], groupId: number): string {
  const byId = new Map(groups.map((g) => [g.id, g]));
  return pathOf(groups, groupId)
    .map((id) => byId.get(id)!.name)
    .join(" · ");
}
