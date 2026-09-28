import type { Prisma, Role } from "@prisma/client";
import { prisma } from "./prisma";
import { cutoutSrc, photoSrc } from "./photoUrl";
import { getOrgStructure } from "./structure";

// THE ORG VIEW loader (grouping Chunk 2) — READ-ONLY browsing data for the
// whole organization. One fetch, one serializable view-model; lib/orgtree
// shapes it into the org tree (/org/view).
//
// MATRIX RESPECT BY CONSTRUCTION: every select below carries CARD INFO ONLY —
// name, photo + card placement, jersey, position, role, career points (the
// card level). No dream, no per-game stats, no contact/guardian data, no
// takeaways; journals are structurally unreachable (nothing outside
// lib/data/reflections.ts can query them — the build gate enforces it). A
// test locks this allowlist.
//
// Photos leave as /api/photo URLs (lib/photoUrl), never as the stored data:
// URLs — a club's worth of inline photos would be megabytes of page.
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
  photoCutoutUrl: string | null;
  photoMeta: Prisma.JsonValue | null; // the cutout's card placement
  careerPoints: number; // career total — the card level
};

export type OrgAdmin = {
  userId: number;
  name: string;
  photoUrl: string | null;
  photoCutoutUrl: string | null;
  photoMeta: Prisma.JsonValue | null;
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
};

export type OrgViewProgram = {
  id: number;
  name: string;
  showDivisions: boolean;
  divisions: OrgViewDivision[];
  divisionCount: number;
  teamCount: number;
};

export type OrgViewData = Awaited<ReturnType<typeof getOrgViewData>>;

const PHOTO = { photoUrl: true, photoCutoutUrl: true, photoMeta: true } as const;

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
        jerseyNumber: true,
        profile: {
          select: {
            userId: true,
            name: true,
            position: true,
            jerseyNumber: true,
            careerPoints: true,
            ...PHOTO,
          },
        },
      },
    }),
    prisma.roleAssignment.findMany({
      where: { organizationId, role: "ORG_ADMIN", revokedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        profile: {
          select: { userId: true, name: true, ...PHOTO },
        },
      },
    }),
  ]);

  // People per team, split STAFF (HC → AC → GM) / PLAYERS (card level, then
  // name — the row reads from the top level down).
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
      photoUrl: photoSrc(m.profile.userId, m.profile.photoUrl),
      photoCutoutUrl: cutoutSrc(m.profile.userId, m.profile.photoCutoutUrl),
      photoMeta: m.profile.photoMeta,
      careerPoints: m.profile.careerPoints,
    };
    const bucket = peopleByTeam.get(m.teamId) ?? { staff: [], players: [] };
    (m.role === "PLAYER" ? bucket.players : bucket.staff).push(person);
    peopleByTeam.set(m.teamId, bucket);
  }
  for (const bucket of peopleByTeam.values()) {
    bucket.staff.sort((a, b) => a.roleRank - b.roleRank || a.name.localeCompare(b.name));
    bucket.players.sort((a, b) => b.careerPoints - a.careerPoints || a.name.localeCompare(b.name));
  }

  const toViewTeam = (t: (typeof allTeams)[number]): OrgViewTeam => {
    const people = peopleByTeam.get(t.id) ?? { staff: [], players: [] };
    return { ...t, ...people, playerCount: people.players.length };
  };

  const programs: OrgViewProgram[] = structure.programs.map((p) => {
    const divisions: OrgViewDivision[] = p.divisions.map((d) => {
      const teams = d.teams.map(toViewTeam);
      return { id: d.id, name: d.name, teams, teamCount: teams.length };
    });
    return {
      id: p.id,
      name: p.name,
      showDivisions: p.showDivisions,
      divisions,
      divisionCount: divisions.length,
      teamCount: divisions.reduce((s, d) => s + d.teamCount, 0),
    };
  });
  const unassignedTeams = structure.unassignedTeams.map(toViewTeam);

  // A player on two teams is one player: count people, not memberships.
  const playerIds = new Set(
    memberships.filter((m) => m.role === "PLAYER" && m.profile.userId != null).map((m) => m.profile.userId),
  );
  const totals = {
    teamCount: allTeams.length,
    playerCount: playerIds.size,
  };

  // Org admins; the EARLIEST unrevoked grant is displayed as the Org Owner.
  const admins: OrgAdmin[] = adminGrants
    .filter((g) => g.profile.userId != null)
    .map((g) => ({
      userId: g.profile.userId!,
      name: g.profile.name,
      photoUrl: photoSrc(g.profile.userId!, g.profile.photoUrl),
      photoCutoutUrl: cutoutSrc(g.profile.userId!, g.profile.photoCutoutUrl),
      photoMeta: g.profile.photoMeta,
    }));

  return {
    org,
    admins,
    owner: admins[0] ?? null,
    programs,
    unassignedTeams,
    showPrograms: structure.showPrograms, // verbatim from lib/structure
    totals,
  };
}
