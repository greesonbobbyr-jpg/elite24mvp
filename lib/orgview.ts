import type { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { getOrgStructure } from "./structure";

// THE ORG VIEW loader (grouping Chunk 2) — READ-ONLY browsing data for the
// whole organization. One fetch, one serializable view-model consumed by both
// the desktop tree and the mobile focus-and-expand explorer.
//
// MATRIX RESPECT BY CONSTRUCTION: every select below carries CARD INFO ONLY —
// name, photo, jersey, position, role, team points. No dream, no per-game
// stats, no contact/guardian data, no takeaways; journals are structurally
// unreachable (nothing outside lib/data/reflections.ts can query them — the
// build gate enforces it). A test locks this allowlist.
//
// Progressive disclosure flags come from lib/structure.getOrgStructure and
// are passed through VERBATIM — never recomputed here.

const STAFF_ORDER: Partial<Record<Role, number>> = {
  HEAD_COACH: 0,
  ASSISTANT_COACH: 1,
  GENERAL_MANAGER: 2,
};

export type OrgPerson = {
  userId: number;
  name: string;
  role: Role;
  roleRank: number;
  jerseyNumber: number | null;
  position: string | null;
  photoUrl: string | null;
  points: number; // membership (team) points — the board number
};

export type OrgViewTeam = {
  id: number;
  name: string;
  joinCode: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  staff: OrgPerson[];
  players: OrgPerson[];
  playerCount: number;
};

export type OrgViewDivision = {
  id: number;
  name: string;
  teams: OrgViewTeam[];
  teamCount: number;
  playerCount: number;
};

export type OrgViewProgram = {
  id: number;
  name: string;
  showDivisions: boolean;
  divisions: OrgViewDivision[];
  divisionCount: number;
  teamCount: number;
  playerCount: number;
};

export type SearchEntry = {
  kind: "program" | "division" | "team" | "staff" | "player";
  id: number;
  name: string;
  detail: string | null; // role label / parent name for the result row
  path: { programId?: number; divisionId?: number; teamId?: number };
  userId?: number;
};

export type OrgViewData = Awaited<ReturnType<typeof getOrgViewData>>;

export async function getOrgViewData(organizationId: number) {
  const [org, structure] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { id: true, name: true },
    }),
    getOrgStructure(organizationId),
  ]);

  const allTeams = [
    ...structure.programs.flatMap((p) => p.divisions.flatMap((d) => d.teams)),
    ...structure.unassignedTeams,
  ];
  const teamIds = allTeams.map((t) => t.id);

  const [memberships, adminGrants] = await Promise.all([
    prisma.membership.findMany({
      where: { teamId: { in: teamIds }, endedAt: null, season: { isCurrent: true } },
      select: {
        teamId: true,
        role: true,
        points: true,
        jerseyNumber: true,
        profile: {
          select: {
            userId: true,
            name: true,
            position: true,
            jerseyNumber: true,
            photoUrl: true,
          },
        },
      },
    }),
    prisma.roleAssignment.findMany({
      where: { organizationId, role: "ORG_ADMIN", revokedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        profile: {
          select: { userId: true, name: true, photoUrl: true },
        },
      },
    }),
  ]);

  // People per team, split STAFF (HC → AC → GM) / PLAYERS (points desc).
  const peopleByTeam = new Map<number, { staff: OrgPerson[]; players: OrgPerson[] }>();
  for (const m of memberships) {
    if (m.profile.userId == null) continue;
    const person: OrgPerson = {
      userId: m.profile.userId,
      name: m.profile.name,
      role: m.role,
      roleRank: STAFF_ORDER[m.role] ?? 99,
      jerseyNumber: m.jerseyNumber ?? m.profile.jerseyNumber,
      position: m.profile.position,
      photoUrl: m.profile.photoUrl,
      points: m.points,
    };
    const bucket = peopleByTeam.get(m.teamId) ?? { staff: [], players: [] };
    (m.role === "PLAYER" ? bucket.players : bucket.staff).push(person);
    peopleByTeam.set(m.teamId, bucket);
  }
  for (const bucket of peopleByTeam.values()) {
    bucket.staff.sort((a, b) => a.roleRank - b.roleRank || a.name.localeCompare(b.name));
    bucket.players.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  }

  const toViewTeam = (t: (typeof allTeams)[number]): OrgViewTeam => {
    const people = peopleByTeam.get(t.id) ?? { staff: [], players: [] };
    return { ...t, ...people, playerCount: people.players.length };
  };

  const programs: OrgViewProgram[] = structure.programs.map((p) => {
    const divisions: OrgViewDivision[] = p.divisions.map((d) => {
      const teams = d.teams.map(toViewTeam);
      return {
        id: d.id,
        name: d.name,
        teams,
        teamCount: teams.length,
        playerCount: teams.reduce((sum, t) => sum + t.playerCount, 0),
      };
    });
    return {
      id: p.id,
      name: p.name,
      showDivisions: p.showDivisions,
      divisions,
      divisionCount: divisions.length,
      teamCount: divisions.reduce((s, d) => s + d.teamCount, 0),
      playerCount: divisions.reduce((s, d) => s + d.playerCount, 0),
    };
  });
  const unassignedTeams = structure.unassignedTeams.map(toViewTeam);

  const totals = {
    programCount: programs.length,
    divisionCount: programs.reduce((s, p) => s + p.divisionCount, 0),
    teamCount: programs.reduce((s, p) => s + p.teamCount, 0) + unassignedTeams.length,
    playerCount:
      programs.reduce((s, p) => s + p.playerCount, 0) +
      unassignedTeams.reduce((s, t) => s + t.playerCount, 0),
  };

  // Org admins; the EARLIEST unrevoked grant is displayed as the org owner.
  const admins = adminGrants
    .filter((g) => g.profile.userId != null)
    .map((g) => ({
      userId: g.profile.userId!,
      name: g.profile.name,
      photoUrl: g.profile.photoUrl,
    }));

  // Flat, org-scoped search index (client-side filtering; orgs are small).
  const searchIndex: SearchEntry[] = [];
  for (const p of programs) {
    searchIndex.push({ kind: "program", id: p.id, name: p.name, detail: null, path: { programId: p.id } });
    for (const d of p.divisions) {
      searchIndex.push({
        kind: "division", id: d.id, name: d.name, detail: p.name,
        path: { programId: p.id, divisionId: d.id },
      });
      for (const t of d.teams) {
        const path = { programId: p.id, divisionId: d.id, teamId: t.id };
        searchIndex.push({ kind: "team", id: t.id, name: t.name, detail: d.name, path });
        for (const person of [...t.staff, ...t.players]) {
          searchIndex.push({
            kind: person.role === "PLAYER" ? "player" : "staff",
            id: person.userId,
            name: person.name,
            detail: `${t.name}`,
            path,
            userId: person.userId,
          });
        }
      }
    }
  }

  return {
    org,
    admins,
    owner: admins[0] ?? null,
    programs,
    unassignedTeams,
    showPrograms: structure.showPrograms, // verbatim from lib/structure
    totals,
    searchIndex,
  };
}
