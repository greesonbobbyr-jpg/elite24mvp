import { describe, expect, it } from "vitest";
import type { OrgPerson, OrgViewProgram, OrgViewTeam } from "../lib/orgview";
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

// THE ORG TREE's shape, selection and search (pure — no database):
//   1. Main/Main: owner straight to the head coaches, no grouping rows.
//   2. One program, several divisions: a divisions row; team labels drop the
//      division's name.
//   3. Several programs: a programs row; a program's lone division stays
//      hidden, several show.
//   4. Teams with no division join the top grouping row as "Other teams", or
//      the coaches row when no grouping row shows.
//   5. A team with no head coach.
//   6. Search finds only what the tree shows, opens the right branch, keeps a
//      two-team player's two entries apart.

let nextUserId = 1;
function person(name: string, role: OrgPerson["role"] = "PLAYER"): OrgPerson {
  return {
    userId: nextUserId++, name, role, roleRank: 0, jerseyNumber: null, position: null,
    photoUrl: null, photoCutoutUrl: null, photoMeta: null, careerPoints: 0, points: 0, teamRank: null,
  };
}
function team(id: number, name: string, people: OrgPerson[] = []): OrgViewTeam {
  const players = people.filter((p) => p.role === "PLAYER");
  return {
    id, name, joinCode: null, logoUrl: null, primaryColor: null, secondaryColor: null,
    staff: people.filter((p) => p.role !== "PLAYER"), players, playerCount: players.length,
  };
}
function program(id: number, name: string, divisions: { id: number; name: string; teams: OrgViewTeam[] }[]): OrgViewProgram {
  return {
    id, name,
    showDivisions: divisions.length > 1, // lib/structure's rule
    divisions: divisions.map((d) => ({ ...d, teamCount: d.teams.length })),
    divisionCount: divisions.length,
    teamCount: divisions.reduce((s, d) => s + d.teams.length, 0),
  };
}
const org = (programs: OrgViewProgram[], unassignedTeams: OrgViewTeam[] = []) => ({
  programs, unassignedTeams, showPrograms: programs.length > 1,
});
const labels = (level: TreeLevel) =>
  level.kind === "groups" ? level.groups.map((g) => g.name) : level.teams.map((t) => t.label);

describe("org tree shape", () => {
  it("Main/Main: owner straight to the head coaches — no grouping rows", () => {
    const thunder = team(1, "OKC Thunder", [person("Coach Riley", "HEAD_COACH"), person("Marcus Green")]);
    const root = buildOrgTree(org([program(1, "Main", [{ id: 1, name: "Main", teams: [thunder] }])]));
    expect(root.kind).toBe("teams");
    expect(treeRows(root, { groups: [], teamId: null }).map((r) => r.kind)).toEqual(["teams"]);
    const open = treeRows(root, { groups: [], teamId: 1 });
    expect(open.map((r) => r.kind)).toEqual(["teams", "players"]);
    expect(open[1]).toMatchObject({ parent: teamNode(1) });
  });

  it("one program, several divisions: a divisions row; labels drop the division", () => {
    const root = buildOrgTree(org([
      program(1, "Boys Basketball", [
        { id: 12, name: "12U", teams: [team(1, "12U Mustang Black"), team(2, "Mustang Red 12U")] },
        { id: 17, name: "17U", teams: [team(3, "Mustang Broncos")] },
      ]),
    ]));
    expect(root.kind).toBe("groups");
    expect(labels(root)).toEqual(["12U", "17U"]);
    const rows = treeRows(root, { groups: ["d12"], teamId: null });
    expect(rows.map((r) => r.kind)).toEqual(["groups", "teams"]);
    expect(rows[1]).toMatchObject({ parent: groupNode("d12") });
    if (rows[1].kind !== "teams") throw new Error("teams row expected");
    expect(rows[1].teams.map((t) => t.label)).toEqual(["Mustang Black", "Mustang Red"]);
  });

  it("several programs: a programs row; a lone division stays hidden, several show", () => {
    const root = buildOrgTree(org([
      program(1, "Boys", [{ id: 1, name: "Main", teams: [team(1, "Boys Varsity")] }]),
      program(2, "Girls", [
        { id: 2, name: "Varsity", teams: [team(2, "Girls Varsity")] },
        { id: 3, name: "JV", teams: [team(3, "Girls JV")] },
      ]),
    ]));
    expect(labels(root)).toEqual(["Boys", "Girls"]);
    if (root.kind !== "groups") throw new Error("groups expected");
    expect(root.groups[0].next.kind).toBe("teams"); // Boys' one division: hidden
    expect(labels(root.groups[1].next)).toEqual(["Varsity", "JV"]);
    expect(treeRows(root, { groups: ["p2", "d3"], teamId: 3 }).map((r) => r.kind)).toEqual(["groups", "groups", "teams", "players"]);
    expect(treeRows(root, { groups: ["p1"], teamId: null }).map((r) => r.kind)).toEqual(["groups", "teams"]);
  });

  it("teams with no division join the coaches row when no grouping row shows", () => {
    const merged = buildOrgTree(org([program(1, "Main", [{ id: 1, name: "Main", teams: [team(1, "A")] }])], [team(2, "B")]));
    expect(labels(merged)).toEqual(["A", "B"]);
    const preBackfill = buildOrgTree(org([], [team(3, "C"), team(4, "D")]));
    expect(labels(preBackfill)).toEqual(["C", "D"]);
  });

  it("…and the top grouping row as Other teams when one shows", () => {
    const root = buildOrgTree(org(
      [program(1, "Main", [{ id: 1, name: "12U", teams: [team(1, "A")] }, { id: 2, name: "13U", teams: [team(2, "B")] }])],
      [team(3, "C")],
    ));
    expect(labels(root)).toEqual(["12U", "13U", OTHER_TEAMS]);
    const rows = treeRows(root, { groups: ["other"], teamId: 3 });
    expect(rows.map((r) => r.kind)).toEqual(["groups", "teams", "players"]);
  });

  it("a team with no head coach: no coach node; other staff stay chips", () => {
    const gm = person("Pat GM", "GENERAL_MANAGER");
    const root = buildOrgTree(org([program(1, "Main", [{ id: 1, name: "Main", teams: [team(1, "14U White", [gm, person("Kid One")])] }])]));
    if (root.kind !== "teams") throw new Error("teams expected");
    expect(root.teams[0].headCoach).toBeNull();
    expect(root.teams[0].staff).toEqual([gm]);
    expect(searchIndex(root, null).some((h) => h.kind === "Head Coach")).toBe(false);
  });

  it("team labels: the division's name comes off either end, never the whole name", () => {
    expect(teamLabel("12U Mustang Black", "12U")).toBe("Mustang Black");
    expect(teamLabel("Mustang Black 12U", "12u")).toBe("Mustang Black");
    expect(teamLabel("Mustang Broncos", "17U")).toBe("Mustang Broncos");
    expect(teamLabel("12U", "12U")).toBe("12U");
    expect(teamLabel("12U Mustang Black", null)).toBe("12U Mustang Black");
  });
});

describe("org tree selection", () => {
  const root = buildOrgTree(org([
    program(1, "Main", [
      { id: 12, name: "12U", teams: [team(1, "12U A"), team(2, "12U B")] },
      { id: 13, name: "13U", teams: [team(3, "13U A")] },
    ]),
  ]));

  it("a stale selection (deleted team, foreign key) keeps only what exists", () => {
    expect(validSelection(root, { groups: ["d12"], teamId: 99 })).toEqual({ groups: ["d12"], teamId: null });
    expect(validSelection(root, { groups: ["d99"], teamId: 1 })).toEqual({ groups: [], teamId: null });
    expect(validSelection(root, { groups: ["d13"], teamId: 1 })).toEqual({ groups: ["d13"], teamId: null }); // team 1 isn't in 13U
    expect(validSelection(root, { groups: ["d12", "junk"], teamId: 2 })).toEqual({ groups: ["d12"], teamId: 2 });
  });

  it("one open branch per level: opening a sibling closes the rest; tapping again closes", () => {
    let sel = toggleGroup({ groups: [], teamId: null }, 0, "d12");
    sel = toggleTeam(sel, 1);
    expect(sel).toEqual({ groups: ["d12"], teamId: 1 });
    expect(toggleGroup(sel, 0, "d13")).toEqual({ groups: ["d13"], teamId: null });
    expect(toggleGroup(sel, 0, "d12")).toEqual({ groups: [], teamId: null });
    expect(toggleTeam(sel, 1)).toEqual({ groups: ["d12"], teamId: null });
    expect(toggleTeam(sel, 2)).toEqual({ groups: ["d12"], teamId: 2 });
  });

  it("the URL's ?at=…&team=… reads back; anything malformed is dropped", () => {
    expect(selectionFromQuery("d12", "2")).toEqual({ groups: ["d12"], teamId: 2 });
    expect(selectionFromQuery("p3.d12.other", null)).toEqual({ groups: ["p3", "d12", "other"], teamId: null });
    expect(selectionFromQuery("d12.<script>.x9", "two")).toEqual({ groups: ["d12"], teamId: null });
    expect(selectionFromQuery(null, null)).toEqual({ groups: [], teamId: null });
  });

  it("the view reopens at the deepest open node", () => {
    expect(openNode({ groups: ["d12"], teamId: 2 })).toBe(teamNode(2));
    expect(openNode({ groups: ["d12"], teamId: null })).toBe(groupNode("d12"));
    expect(openNode({ groups: [], teamId: null })).toBeNull();
  });
});

describe("org tree search", () => {
  const casey = person("Casey Rivers");
  const hc = person("Coach Gary", "HEAD_COACH");
  const root = buildOrgTree(org([
    program(1, "Main", [
      { id: 16, name: "16U", teams: [team(1, "Mustang JV", [person("Coach Jamie", "HEAD_COACH"), casey, person("Diego Ramirez")])] },
      { id: 17, name: "17U", teams: [team(2, "Mustang Broncos", [hc, person("Coach Dana", "ASSISTANT_COACH"), casey])] },
    ]),
  ]));
  const index = searchIndex(root, { name: "Coach Gary" });

  it("finds only what the tree shows: no hidden program", () => {
    expect(search(index, "main")).toEqual([]);
    expect(search(index, "16u").map((h) => h.kind)).toEqual(["Division"]);
  });

  it("a player opens their team's branch and flashes their card", () => {
    const [hit] = search(index, "diego");
    expect(hit).toMatchObject({ kind: "Player", sub: "Mustang JV", selection: { groups: ["d16"], teamId: 1 } });
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
    expect(search(index, "dana")[0]).toMatchObject({ kind: "Asst. Coach", selection: { groups: ["d17"], teamId: 2 } });
    expect(search(index, "  ")).toEqual([]);
  });

  it("names with a word starting with the query rank first", () => {
    const small = buildOrgTree(org([program(1, "Main", [{ id: 1, name: "Main", teams: [team(9, "T", [person("Nico Ward"), person("Cole Barnes")])] }])]));
    expect(search(searchIndex(small, null), "co").map((h) => h.label)).toEqual(["Cole Barnes", "Nico Ward"]);
  });
});
