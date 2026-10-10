import type { Role } from "@prisma/client";
import { bySortOrder, GROUP_KIND_LABEL, type GroupRow } from "./groups";
import type { OrgPerson, OrgViewData, OrgViewTeam } from "./orgview";

// THE ORG TREE (the owner's sketch, design/reference/org-tree-sketch.jpg):
// Org Owner → groups (any depth: Boys/Girls, age groups, levels, schools) →
// head coaches → players, one open branch per level. Pure: the Organization
// View's Tree tab renders it, tests drive it.
//
// PROGRESSIVE DISCLOSURE — one rule, every level: a level holding exactly
// one group and no teams is skipped (its group's own level shows instead).
// A skipped layer appears nowhere — not as a row, not in search — so a club
// with a single "Boys" program goes straight to its age groups, and a
// one-team org goes straight from its owner to its head coach. Teams sitting
// beside groups at the same level gather under "Other teams".

export type TreeTeam = {
  id: number;
  name: string;
  /** The name under its group badge ("12U Mustang Black" → "Mustang Black"). */
  label: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  headCoach: OrgPerson | null;
  /** The rest of the staff (assistant coaches, GMs), shown as chips. */
  staff: OrgPerson[];
  players: OrgPerson[];
};

export type TreeGroup = {
  key: string;
  kind: "group" | "other";
  /** What kind of group it is, for search ("Age group", "School"…). */
  label: string;
  name: string;
  teamCount: number;
  next: TreeLevel;
};

export type TreeLevel = { kind: "groups"; groups: TreeGroup[] } | { kind: "teams"; teams: TreeTeam[] };

/** The open branch: a group key per grouping row, then the open team. */
export type Selection = { groups: string[]; teamId: number | null };

export const OTHER_TEAMS = "Other teams";

// Node ids tag the rendered nodes (data-node) for the connector lines, the
// search flash and scrolling. A two-team player has one node per team.
export const OWNER_NODE = "owner";
export const groupNode = (key: string) => `g-${key}`;
export const teamNode = (teamId: number) => `t-${teamId}`;
export const playerNode = (teamId: number, userId: number) => `p-${teamId}-${userId}`;
export const staffNode = (teamId: number, userId: number) => `s-${teamId}-${userId}`;

/** A team's name under its group, the group's own name dropped from either
 * end: "12U Mustang Black" under 12U reads "Mustang Black". */
export function teamLabel(team: string, group: string | null): string {
  if (!group) return team;
  const name = team.trim();
  const lower = name.toLowerCase();
  const g = group.trim().toLowerCase();
  let label = name;
  if (lower.startsWith(`${g} `)) label = name.slice(g.length + 1);
  else if (lower.endsWith(` ${g}`)) label = name.slice(0, -(g.length + 1));
  return label.trim() || name;
}

function toTreeTeam(team: OrgViewTeam, group: string | null): TreeTeam {
  const headCoach = team.staff.find((s) => s.role === "HEAD_COACH") ?? null;
  return {
    id: team.id,
    name: team.name,
    label: teamLabel(team.name, group),
    logoUrl: team.logoUrl,
    primaryColor: team.primaryColor,
    secondaryColor: team.secondaryColor,
    headCoach,
    staff: team.staff.filter((s) => s !== headCoach),
    players: team.players,
  };
}

type TreeSource = Pick<OrgViewData, "groups" | "teams">;

export function buildOrgTree(data: TreeSource): TreeLevel {
  const present = new Set(data.groups.map((g) => g.id));
  // A group whose parent isn't in the data (a group admin's branch) is top level.
  const parentOf = (g: GroupRow) => (g.parentId != null && present.has(g.parentId) ? g.parentId : null);
  const groupsUnder = new Map<number | null, GroupRow[]>();
  for (const g of data.groups) {
    const list = groupsUnder.get(parentOf(g)) ?? [];
    list.push(g);
    groupsUnder.set(parentOf(g), list);
  }
  for (const list of groupsUnder.values()) list.sort(bySortOrder);
  const teamsIn = new Map<number | null, OrgViewTeam[]>();
  for (const t of data.teams) {
    const at = t.groupId != null && present.has(t.groupId) ? t.groupId : null;
    teamsIn.set(at, [...(teamsIn.get(at) ?? []), t]);
  }
  const teamCount = (id: number): number =>
    (teamsIn.get(id)?.length ?? 0) + (groupsUnder.get(id) ?? []).reduce((n, g) => n + teamCount(g.id), 0);

  // `name` = the group these teams sit directly in (its name comes off their labels).
  const level = (parentId: number | null, name: string | null): TreeLevel => {
    const groups = groupsUnder.get(parentId) ?? [];
    const teams = (teamsIn.get(parentId) ?? []).map((t) => toTreeTeam(t, name));
    if (groups.length === 1 && teams.length === 0) return level(groups[0].id, groups[0].name);
    if (groups.length === 0) return { kind: "teams", teams };
    const row: TreeGroup[] = groups.map((g) => ({
      key: `g${g.id}`,
      kind: "group",
      label: GROUP_KIND_LABEL[g.kind],
      name: g.name,
      teamCount: teamCount(g.id),
      next: level(g.id, g.name),
    }));
    if (teams.length > 0) {
      row.push({
        key: `o${parentId ?? 0}`,
        kind: "other",
        label: "",
        name: OTHER_TEAMS,
        teamCount: teams.length,
        next: { kind: "teams", teams },
      });
    }
    return { kind: "groups", groups: row };
  };
  return level(null, null);
}

export type TreeRow =
  | { kind: "groups"; parent: string; groups: TreeGroup[]; open: string | null }
  | { kind: "teams"; parent: string; teams: TreeTeam[]; open: number | null }
  | { kind: "players"; parent: string; team: TreeTeam };

/** The rows to draw: each grouping row down the open path, then the open
 * group's head coaches, then the open team's players. Parts of a selection
 * that don't exist (a stale link) are ignored. */
export function treeRows(root: TreeLevel, selection: Selection): TreeRow[] {
  const rows: TreeRow[] = [];
  let level = root;
  let parent = OWNER_NODE;
  for (let depth = 0; level.kind === "groups"; depth++) {
    const open = level.groups.find((g) => g.key === selection.groups[depth]) ?? null;
    rows.push({ kind: "groups", parent, groups: level.groups, open: open?.key ?? null });
    if (!open) return rows;
    parent = groupNode(open.key);
    level = open.next;
  }
  const team = level.teams.find((t) => t.id === selection.teamId) ?? null;
  rows.push({ kind: "teams", parent, teams: level.teams, open: team?.id ?? null });
  if (team) rows.push({ kind: "players", parent: teamNode(team.id), team });
  return rows;
}

/** The open branch as the page URL keeps it: ?at=g12.g40 (group keys joined
 * by ".") and &team=45. Anything malformed is dropped. */
export function selectionFromQuery(at: string | null, team: string | null): Selection {
  const teamId = Number.parseInt(team ?? "", 10);
  return {
    groups: (at ?? "").split(".").filter((key) => /^[go]\d+$/.test(key)),
    teamId: Number.isInteger(teamId) ? teamId : null,
  };
}

/** The part of a selection that exists in this tree. */
export function validSelection(root: TreeLevel, selection: Selection): Selection {
  const valid: Selection = { groups: [], teamId: null };
  for (const row of treeRows(root, selection)) {
    if (row.kind === "groups" && row.open) valid.groups.push(row.open);
    if (row.kind === "teams") valid.teamId = row.open;
  }
  return valid;
}

/** Tap a group badge: open it (closing everything below), or close it. */
export function toggleGroup(selection: Selection, depth: number, key: string): Selection {
  const above = selection.groups.slice(0, depth);
  return selection.groups[depth] === key ? { groups: above, teamId: null } : { groups: [...above, key], teamId: null };
}

/** Tap a head coach: open their team's players, or close them. */
export function toggleTeam(selection: Selection, teamId: number): Selection {
  return { ...selection, teamId: selection.teamId === teamId ? null : teamId };
}

/** The deepest open node — where the view should be when it (re)opens. */
export function openNode(selection: Selection): string | null {
  if (selection.teamId != null) return teamNode(selection.teamId);
  const last = selection.groups.at(-1);
  return last ? groupNode(last) : null;
}

// ---- search ------------------------------------------------------------------

export type SearchHit = {
  key: string;
  kind: string;
  label: string;
  sub: string;
  /** What to open, and the node to flash and scroll to. */
  selection: Selection;
  node: string;
};

const STAFF_SHORT: Partial<Record<Role, string>> = {
  HEAD_COACH: "Head Coach",
  ASSISTANT_COACH: "Asst. Coach",
  GENERAL_MANAGER: "GM",
};
export const staffShort = (role: Role) => STAFF_SHORT[role] ?? "Staff";

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Everything findable, in tree order. Built from the tree itself, so only
 * what the tree shows can be found. */
export function searchIndex(root: TreeLevel, owner: { name: string } | null): SearchHit[] {
  const hits: SearchHit[] = [];
  if (owner) {
    hits.push({ key: OWNER_NODE, kind: "Org Owner", label: owner.name, sub: "", selection: { groups: [], teamId: null }, node: OWNER_NODE });
  }
  const walk = (level: TreeLevel, path: string[], names: string[]) => {
    if (level.kind === "groups") {
      for (const g of level.groups) {
        const at = [...path, g.key];
        if (g.kind !== "other") {
          hits.push({
            key: groupNode(g.key),
            kind: g.label,
            label: g.name,
            sub: [...names, count(g.teamCount, "team")].join(" · "),
            selection: { groups: at, teamId: null },
            node: groupNode(g.key),
          });
        }
        walk(g.next, at, g.kind === "other" ? names : [...names, g.name]);
      }
      return;
    }
    for (const t of level.teams) {
      const opened = { groups: path, teamId: t.id };
      hits.push({ key: teamNode(t.id), kind: "Team", label: t.name, sub: [...names, count(t.players.length, "player")].join(" · "), selection: opened, node: teamNode(t.id) });
      if (t.headCoach) {
        // The coach's card is in the coaches row: open the group, flash the card.
        hits.push({ key: `hc-${t.id}-${t.headCoach.userId}`, kind: "Head Coach", label: t.headCoach.name, sub: t.name, selection: { groups: path, teamId: null }, node: teamNode(t.id) });
      }
      for (const s of t.staff) {
        hits.push({ key: staffNode(t.id, s.userId), kind: staffShort(s.role), label: s.name, sub: t.name, selection: opened, node: staffNode(t.id, s.userId) });
      }
      for (const p of t.players) {
        hits.push({ key: playerNode(t.id, p.userId), kind: "Player", label: p.name, sub: t.name, selection: opened, node: playerNode(t.id, p.userId) });
      }
    }
  };
  walk(root, [], []);
  return hits;
}

/** Hits whose name contains the query; names with a word starting with it first. */
export function search(index: SearchHit[], query: string, limit = 8): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches = index.filter((h) => h.label.toLowerCase().includes(q));
  const leads = (h: SearchHit) => h.label.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)) || h.label.toLowerCase().startsWith(q);
  return [...matches.filter(leads), ...matches.filter((h) => !leads(h))].slice(0, limit);
}
