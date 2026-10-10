import { describe, expect, it } from "vitest";
import type { GroupKind } from "@prisma/client";
import type { GroupRow } from "../lib/groups";
import type { OrgPerson, OrgViewTeam } from "../lib/orgview";
import {
  buildOrgTree,
  groupNode,
  openNode,
  OTHER_TEAMS,
  playerNode,
  search,
  searchIndex,
  selectionFromQuery,
  teamLabel,
  teamNode,
  toggleGroup,
  toggleTeam,
  treeRows,
  validSelection,
  type TreeLevel,
} from "../lib/orgtree";

// THE ORG TREE's shape, selection and search (pure — no database), over the
// group tree (person-first plan Phase 2):
//   1. No groups: owner straight to the head coaches.
//   2. THE disclosure rule, at every level: a level holding exactly one group
//      and no teams is skipped — its group's own level shows instead.
//   3. Teams beside groups at a level gather under "Other teams".
//   4. A group admin's branch (a group whose parent isn't in the data) is
//      the top level; trees go four levels deep.
//   5. A team with no head coach; team labels.
//   6. Selection (URL keys g<id>/o<id>) and search.

let nextUserId = 1;
function person(name: string, role: OrgPerson["role"] = "PLAYER"): OrgPerson {
  return {
    userId: nextUserId++, name, role, roleRank: 0, jerseyNumber: null, position: null,
    photoUrl: null, photoCutoutUrl: null, photoMeta: null, careerPoints: 0, points: 0, teamRank: null,
  };
}
function team(id: number, name: string, groupId: number | null = null, people: OrgPerson[] = []): OrgViewTeam {
  const players = people.filter((p) => p.role === "PLAYER");
  return {
    id, name, groupId, joinCode: null, logoUrl: null, primaryColor: null, secondaryColor: null,
    staff: people.filter((p) => p.role !== "PLAYER"), players, playerCount: players.length,
  };
}
function group(id: number, name: string, parentId: number | null = null, kind: GroupKind = "AGE_GROUP", sortOrder = 0): GroupRow {
  return { id, name, parentId, kind, sortOrder, depth: parentId == null ? 1 : 2 };
}
const org = (groups: GroupRow[], teams: OrgViewTeam[]) => ({ groups, teams });
const labels = (level: TreeLevel) =>
  level.kind === "groups" ? level.groups.map((g) => g.name) : level.teams.map((t) => t.label);

describe("org tree shape", () => {
  it("no groups: owner straight to the head coaches — no grouping rows", () => {
    const thunder = team(1, "OKC Thunder", null, [person("Coach Riley", "HEAD_COACH"), person("Marcus Green")]);
    const root = buildOrgTree(org([], [thunder]));
    expect(root.kind).toBe("teams");
    expect(treeRows(root, { groups: [], teamId: null }).map((r) => r.kind)).toEqual(["teams"]);
    const open = treeRows(root, { groups: [], teamId: 1 });
    expect(open.map((r) => r.kind)).toEqual(["teams", "players"]);
    expect(open[1]).toMatchObject({ parent: teamNode(1) });
  });

  it("a lone top group is skipped: its age groups are the first row; labels drop the group", () => {
    const root = buildOrgTree(org(
      [group(1, "Boys", null, "GENDER"), group(12, "12U", 1, "AGE_GROUP", 0), group(17, "17U", 1, "AGE_GROUP", 1)],
      [team(1, "12U Mustang Black", 12), team(2, "Mustang Red 12U", 12), team(3, "Mustang Broncos", 17)],
    ));
    expect(labels(root)).toEqual(["12U", "17U"]);
    const rows = treeRows(root, { groups: ["g12"], teamId: null });
    expect(rows.map((r) => r.kind)).toEqual(["groups", "teams"]);
    expect(rows[1]).toMatchObject({ parent: groupNode("g12") });
    if (rows[1].kind !== "teams") throw new Error("teams row expected");
    expect(rows[1].teams.map((t) => t.label)).toEqual(["Mustang Black", "Mustang Red"]);
  });

  it("several groups show; a lone group deeper down is skipped too", () => {
    const root = buildOrgTree(org(
      [
        group(1, "Boys", null, "GENDER", 0),
        group(10, "Main", 1, "CUSTOM"),
        group(2, "Girls", null, "GENDER", 1),
        group(20, "Varsity", 2, "LEVEL", 0),
        group(21, "JV", 2, "LEVEL", 1),
      ],
      [team(1, "Boys Varsity", 10), team(2, "Girls Varsity", 20), team(3, "Girls JV", 21)],
    ));
    expect(labels(root)).toEqual(["Boys", "Girls"]);
    if (root.kind !== "groups") throw new Error("groups expected");
    expect(root.groups[0].next.kind).toBe("teams"); // Boys' lone "Main": skipped
    expect(root.groups.map((g) => g.teamCount)).toEqual([1, 2]);
    expect(labels(root.groups[1].next)).toEqual(["Varsity", "JV"]);
    expect(treeRows(root, { groups: ["g2", "g21"], teamId: 3 }).map((r) => r.kind)).toEqual(["groups", "groups", "teams", "players"]);
    expect(treeRows(root, { groups: ["g1"], teamId: null }).map((r) => r.kind)).toEqual(["groups", "teams"]);
  });

  it("no groups: every team is in the coaches row", () => {
    expect(labels(buildOrgTree(org([], [team(3, "C"), team(4, "D")])))).toEqual(["C", "D"]);
  });

  it("teams beside groups gather under Other teams — at the top or inside a group", () => {
    const top = buildOrgTree(org([group(12, "12U", null, "AGE_GROUP", 0), group(13, "13U", null, "AGE_GROUP", 1)], [team(1, "A", 12), team(2, "B", 13), team(3, "C")]));
    expect(labels(top)).toEqual(["12U", "13U", OTHER_TEAMS]);
    expect(treeRows(top, { groups: ["o0"], teamId: 3 }).map((r) => r.kind)).toEqual(["groups", "teams", "players"]);

    const inside = buildOrgTree(org(
      [group(1, "Boys", null, "GENDER", 0), group(2, "Girls", null, "GENDER", 1), group(12, "12U", 1)],
      [team(1, "A", 12), team(2, "Boys Elite", 1), team(3, "Girls One", 2)],
    ));
    if (inside.kind !== "groups") throw new Error("groups expected");
    expect(labels(inside.groups[0].next)).toEqual(["12U", OTHER_TEAMS]);
    if (inside.groups[0].next.kind !== "groups") throw new Error("groups expected");
    expect(inside.groups[0].next.groups[1].key).toBe("o1");
  });

  it("a group admin's branch: a group whose parent isn't present is top level", () => {
    const root = buildOrgTree(org([group(30, "15U", 2), group(31, "16U", 2)], [team(1, "15U Girls", 30), team(2, "16U Girls", 31)]));
    expect(labels(root)).toEqual(["15U", "16U"]);
  });

  it("four levels: district → school → (lone Boys, skipped) → levels", () => {
    const root = buildOrgTree(org(
      [
        group(1, "Lincoln High", null, "SCHOOL", 0),
        group(2, "Boys", 1, "GENDER"),
        { ...group(3, "JV", 2, "LEVEL", 0), depth: 3 },
        { ...group(4, "Varsity", 2, "LEVEL", 1), depth: 3 },
        group(5, "Lincoln Middle", null, "SCHOOL", 1),
        group(6, "8th Grade", 5, "LEVEL"),
      ],
      [team(1, "Lincoln JV", 3), team(2, "Lincoln Varsity", 4), team(3, "Lincoln 8th", 6)],
    ));
    expect(labels(root)).toEqual(["Lincoln High", "Lincoln Middle"]);
    if (root.kind !== "groups") throw new Error("groups expected");
    expect(labels(root.groups[0].next)).toEqual(["JV", "Varsity"]);
    expect(labels(root.groups[1].next)).toEqual(["Lincoln 8th"]); // 8th Grade: lone → skipped
  });

  it("a team with no head coach: no coach node; other staff stay chips", () => {
    const gm = person("Pat GM", "GENERAL_MANAGER");
    const root = buildOrgTree(org([], [team(1, "14U White", null, [gm, person("Kid One")])]));
    if (root.kind !== "teams") throw new Error("teams expected");
    expect(root.teams[0].headCoach).toBeNull();
    expect(root.teams[0].staff).toEqual([gm]);
    expect(searchIndex(root, null).some((h) => h.kind === "Head Coach")).toBe(false);
  });

  it("team labels: the group's name comes off either end, never the whole name", () => {
    expect(teamLabel("12U Mustang Black", "12U")).toBe("Mustang Black");
    expect(teamLabel("Mustang Black 12U", "12u")).toBe("Mustang Black");
    expect(teamLabel("Mustang Broncos", "17U")).toBe("Mustang Broncos");
    expect(teamLabel("12U", "12U")).toBe("12U");
    expect(teamLabel("12U Mustang Black", null)).toBe("12U Mustang Black");
  });
});

describe("org tree selection", () => {
  const root = buildOrgTree(org(
    [group(12, "12U", null, "AGE_GROUP", 0), group(13, "13U", null, "AGE_GROUP", 1)],
    [team(1, "12U A", 12), team(2, "12U B", 12), team(3, "13U A", 13)],
  ));

  it("a stale selection (deleted team, foreign key) keeps only what exists", () => {
    expect(validSelection(root, { groups: ["g12"], teamId: 99 })).toEqual({ groups: ["g12"], teamId: null });
    expect(validSelection(root, { groups: ["g99"], teamId: 1 })).toEqual({ groups: [], teamId: null });
    expect(validSelection(root, { groups: ["g13"], teamId: 1 })).toEqual({ groups: ["g13"], teamId: null }); // team 1 isn't in 13U
    expect(validSelection(root, { groups: ["g12", "junk"], teamId: 2 })).toEqual({ groups: ["g12"], teamId: 2 });
  });

  it("one open branch per level: opening a sibling closes the rest; tapping again closes", () => {
    let sel = toggleGroup({ groups: [], teamId: null }, 0, "g12");
    sel = toggleTeam(sel, 1);
    expect(sel).toEqual({ groups: ["g12"], teamId: 1 });
    expect(toggleGroup(sel, 0, "g13")).toEqual({ groups: ["g13"], teamId: null });
    expect(toggleGroup(sel, 0, "g12")).toEqual({ groups: [], teamId: null });
    expect(toggleTeam(sel, 1)).toEqual({ groups: ["g12"], teamId: null });
    expect(toggleTeam(sel, 2)).toEqual({ groups: ["g12"], teamId: 2 });
  });

  it("the URL's ?at=…&team=… reads back; anything malformed (or an old p/d key) is dropped", () => {
    expect(selectionFromQuery("g12", "2")).toEqual({ groups: ["g12"], teamId: 2 });
    expect(selectionFromQuery("g3.g12.o0", null)).toEqual({ groups: ["g3", "g12", "o0"], teamId: null });
    expect(selectionFromQuery("g12.<script>.x9.p3.d4", "two")).toEqual({ groups: ["g12"], teamId: null });
    expect(selectionFromQuery(null, null)).toEqual({ groups: [], teamId: null });
  });

  it("the view reopens at the deepest open node", () => {
    expect(openNode({ groups: ["g12"], teamId: 2 })).toBe(teamNode(2));
    expect(openNode({ groups: ["g12"], teamId: null })).toBe(groupNode("g12"));
    expect(openNode({ groups: [], teamId: null })).toBeNull();
  });
});

describe("org tree search", () => {
  const casey = person("Casey Rivers");
  const hc = person("Coach Gary", "HEAD_COACH");
  const root = buildOrgTree(org(
    [group(1, "Boys", null, "GENDER"), group(16, "16U", 1, "AGE_GROUP", 0), group(17, "17U", 1, "AGE_GROUP", 1)],
    [
      team(1, "Mustang JV", 16, [person("Coach Jamie", "HEAD_COACH"), casey, person("Diego Ramirez")]),
      team(2, "Mustang Broncos", 17, [hc, person("Coach Dana", "ASSISTANT_COACH"), casey]),
    ],
  ));
  const index = searchIndex(root, { name: "Coach Gary" });

  it("finds only what the tree shows: no skipped group; groups by their kind", () => {
    expect(search(index, "boys")).toEqual([]);
    expect(search(index, "16u").map((h) => h.kind)).toEqual(["Age group"]);
  });

  it("a player opens their team's branch and flashes their card", () => {
    const [hit] = search(index, "diego");
    expect(hit).toMatchObject({ kind: "Player", sub: "Mustang JV", selection: { groups: ["g16"], teamId: 1 } });
    const players = treeRows(root, hit.selection).at(-1);
    if (players?.kind !== "players") throw new Error("players row expected");
    expect(players.team.players.some((p) => playerNode(players.team.id, p.userId) === hit.node)).toBe(true);
  });

  it("a two-team player: one hit per team, unique keys", () => {
    const hits = search(index, "casey");
    expect(hits.map((h) => h.sub)).toEqual(["Mustang JV", "Mustang Broncos"]);
    expect(new Set(index.map((h) => h.key)).size).toBe(index.length);
  });

  it("owner, head coach and staff are findable", () => {
    expect(search(index, "gary").map((h) => h.kind)).toEqual(["Org Owner", "Head Coach"]);
    expect(search(index, "dana")[0]).toMatchObject({ kind: "Asst. Coach", selection: { groups: ["g17"], teamId: 2 } });
    expect(search(index, "  ")).toEqual([]);
  });

  it("names with a word starting with the query rank first", () => {
    const small = buildOrgTree(org([], [team(9, "T", null, [person("Nico Ward"), person("Cole Barnes")])]));
    expect(search(searchIndex(small, null), "co").map((h) => h.label)).toEqual(["Cole Barnes", "Nico Ward"]);
  });
});
