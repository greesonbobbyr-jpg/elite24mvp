import { describe, expect, it } from "vitest";
import type { GroupKind } from "@prisma/client";
import {
  canAddUnder,
  canMove,
  childrenByParent,
  depthsAfterMove,
  descendantsOf,
  groupLabel,
  MAX_GROUP_DEPTH,
  pathOf,
  subtreeHeight,
  type GroupRow,
} from "../lib/groups";
import { countGroups, templateDepth, templateGroups } from "../lib/structure-templates";
import { canShapeAt, orgAccessFor } from "../lib/orgaccess";

// THE GROUP TREE (person-first plan Phase 2, owner 2026-10-09):
//   1. Tree rules: paths, descendants, depth ≤ 4, no group inside itself.
//   2. Templates: club / school / district shapes, all within the limits.
//   3. Who may open an Organization View, and where they may change things —
//      a group admin only inside their branch, never their own group's place.
//   (The backfill is tests/backfill-groups.test.ts.)

const g = (id: number, parentId: number | null, depth: number, name = `G${id}`, kind: GroupKind = "CUSTOM"): GroupRow => ({
  id, parentId, depth, name, kind, sortOrder: 0,
});
//   1 Boys ─ 2 12U ─ 3 Black ─ 4 A        (4 levels)
//          └ 5 13U
//   6 Girls
const TREE = [g(1, null, 1, "Boys"), g(2, 1, 2, "12U"), g(3, 2, 3, "Black"), g(4, 3, 4, "A"), g(5, 1, 2, "13U"), g(6, null, 1, "Girls")];

describe("group tree rules", () => {
  it("paths run top-down; descendants go every depth; a broken chain never loops", () => {
    expect(pathOf(TREE, 4)).toEqual([1, 2, 3, 4]);
    expect(pathOf(TREE, null)).toEqual([]);
    expect(descendantsOf(TREE, 1).sort()).toEqual([2, 3, 4, 5]);
    expect(descendantsOf(TREE, 6)).toEqual([]);
    const loop = [g(1, 2, 1), g(2, 1, 2)];
    expect(pathOf(loop, 1).length).toBeLessThanOrEqual(2);
    expect(groupLabel(TREE, 3)).toBe("Boys · 12U · Black");
    expect(childrenByParent(TREE).get(null)!.map((x) => x.id)).toEqual([1, 6]);
  });

  it(`depth stops at ${MAX_GROUP_DEPTH}`, () => {
    expect(canAddUnder(TREE, null)).toEqual({ ok: true, depth: 1 });
    expect(canAddUnder(TREE, 3)).toEqual({ ok: true, depth: 4 });
    expect(canAddUnder(TREE, 4).ok).toBe(false);
    expect(canAddUnder(TREE, 99).ok).toBe(false);
    expect(subtreeHeight(TREE, 1)).toBe(4);
  });

  it("moves: never inside itself or its descendants; never past the depth limit", () => {
    expect(canMove(TREE, 1, 3).ok).toBe(false); // into its own grandchild
    expect(canMove(TREE, 2, 2).ok).toBe(false); // into itself
    expect(canMove(TREE, 2, 6).ok).toBe(true); // 12U (3 levels) under Girls: depth 2–4
    expect(canMove(TREE, 1, 6).ok).toBe(false); // Boys (4 levels) under Girls: 5 deep
    expect(canMove(TREE, 5, null)).toEqual({ ok: true, depth: 1 });
    const depths = depthsAfterMove(TREE, 2, 1);
    expect(Object.fromEntries(depths)).toEqual({ 2: 1, 3: 2, 4: 3 });
  });
});

describe("starting shapes", () => {
  it("club: Boys / Girls → ages; one side → just the ages", () => {
    const both = templateGroups({ template: "club", genders: ["Boys", "Girls"], ages: [17, 12, 12, 99] });
    if (!both.ok) throw new Error(both.error);
    expect(both.groups.map((x) => x.name)).toEqual(["Boys", "Girls"]);
    expect(both.groups[0].children!.map((x) => x.name)).toEqual(["12U", "17U"]);
    const one = templateGroups({ template: "club", genders: ["Girls"], ages: [15, 16] });
    expect(one.ok && one.groups.map((x) => x.name)).toEqual(["15U", "16U"]);
    expect(templateGroups({ template: "club", genders: [], ages: [12] }).ok).toBe(false);
  });

  it("school: Junior High and/or High School; split Boys / Girls first", () => {
    const hs = templateGroups({ template: "school", juniorHigh: false, highSchool: true, splitGenders: false });
    expect(hs.ok && hs.groups.map((x) => x.name)).toEqual(["Freshman", "JV", "Varsity"]);
    const full = templateGroups({ template: "school", juniorHigh: true, highSchool: true, splitGenders: true });
    if (!full.ok) throw new Error(full.error);
    expect(full.groups.map((x) => x.name)).toEqual(["Boys", "Girls"]);
    expect(full.groups[1].children!.map((x) => x.name)).toEqual(["Junior High", "High School"]);
    expect(countGroups(full.groups)).toBe(2 + 2 * (1 + 2 + 1 + 3)); // 2 sides × (JH + 2 grades + HS + 3 levels)
    expect(templateGroups({ template: "school", juniorHigh: false, highSchool: false, splitGenders: false }).ok).toBe(false);
  });

  it("district: schools → their levels, at most 4 deep", () => {
    const d = templateGroups({ template: "district", schools: ["Lincoln High", " lincoln high ", "Lincoln High", "", "Roosevelt"], juniorHigh: true, highSchool: true, splitGenders: true });
    if (!d.ok) throw new Error(d.error);
    expect(d.groups.map((x) => x.name)).toEqual(["Lincoln High", "lincoln high", "Roosevelt"]);
    expect(templateDepth(d.groups)).toBe(MAX_GROUP_DEPTH);
    expect(templateGroups({ template: "district", schools: [], juniorHigh: true, highSchool: false, splitGenders: false }).ok).toBe(false);
  });
});

describe("Organization View access", () => {
  const base = { memberships: [] as never[], platformRole: null as "CEO" | null, profile: { id: 7 } as { id: number } | null };
  it("org admin: whole org; group admin: their branch; CEO: any org; others: none", () => {
    expect(orgAccessFor({ ...base, orgAdminOf: [3], groupAdminOf: [] }, 3)).toMatchObject({ via: "org_admin", branch: null });
    expect(orgAccessFor({ ...base, orgAdminOf: [], groupAdminOf: [{ organizationId: 3, groupId: 6 }] }, 3)).toMatchObject({ via: "group_admin", branch: [6] });
    expect(orgAccessFor({ ...base, orgAdminOf: [], groupAdminOf: [], platformRole: "CEO" }, 99)).toMatchObject({ via: "ceo" });
    expect(orgAccessFor({ ...base, orgAdminOf: [4], groupAdminOf: [] }, 3)).toBeNull();
    expect(orgAccessFor({ ...base, profile: null, orgAdminOf: [3], groupAdminOf: [] }, 3)).toBeNull();
  });

  it("a group admin shapes inside their branch — not their own group's place, not elsewhere", () => {
    const ctx = { ...base, orgAdminOf: [], groupAdminOf: [{ organizationId: 3, groupId: 1 }] };
    const access = orgAccessFor(ctx, 3)!;
    expect(canShapeAt(ctx, access, TREE, 1)).toBe(true); // inside Boys
    expect(canShapeAt(ctx, access, TREE, 3)).toBe(true); // deeper inside
    expect(canShapeAt(ctx, access, TREE, null)).toBe(false); // the org's top level (Boys' own place)
    expect(canShapeAt(ctx, access, TREE, 6)).toBe(false); // Girls
    const admin = { ...base, orgAdminOf: [3], groupAdminOf: [] };
    expect(canShapeAt(admin, orgAccessFor(admin, 3)!, TREE, null)).toBe(true);
  });
});
