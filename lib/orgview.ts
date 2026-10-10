import type { Prisma, Role } from "@prisma/client";
import { prisma } from "./prisma";
import { rank1224 } from "./leaderboard";
import { cutoutSrc, photoSrc } from "./photoUrl";
import { descendantsOf, loadOrgGroups, type GroupRow } from "./groups";

// THE ORG VIEW loader (grouping Chunk 2) — READ-ONLY browsing data for the
// whole organization. One fetch, one serializable view-model; lib/orgtree
// shapes it into the org tree (Organization View · Tree, /org/[orgId]).
//
// MATRIX RESPECT BY CONSTRUCTION: every select below carries CARD INFO ONLY —
// name, photo + card placement, jersey, position, role, career points (the
// card level), team points and place on the team board — what the player's
// card shows. No dream, no per-game stats, no contact/guardian data, no
// takeaways; journals are structurally unreachable (nothing outside
// lib/data/reflections.ts can query them — the build gate enforces it). A
// test locks this allowlist.
//
// Photos leave as /api/photo URLs (lib/photoUrl), never as the stored data:
// URLs — a club's worth of inline photos would be megabytes of page.
//
// Structure comes from the group tree (lib/groups) as FLAT lists — groups and
// teams with their groupId; lib/orgtree shapes them (and applies the
// disclosure rule). A GROUP_ADMIN's view passes `branch`: only those groups,
// everything under them, and their teams.

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
  points: number; // team points — the team board's number
  /** Place on the team board (1224, as on the player's card); staff: null. */
  teamRank: number | null;
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
  groupId: number | null;
  joinCode: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  staff: OrgPerson[];
  players: OrgPerson[];
  playerCount: number;
};

export type OrgViewData = Awaited<ReturnType<typeof getOrgViewData>>;

const PHOTO = { photoUrl: true, photoCutoutUrl: true, photoMeta: true } as const;

export async function getOrgViewData(organizationId: number, opts: { branch?: readonly number[] } = {}) {
  const [org, allGroups, orgTeams] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { id: true, name: true },
    }),
    loadOrgGroups(organizationId),
    prisma.team.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        groupId: true,
        joinCode: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
      },
    }),
  ]);

  // A group admin's part: their groups and everything under them.
  let groups: GroupRow[] = allGroups;
  let allTeams = orgTeams;
  if (opts.branch) {
    const inBranch = new Set(opts.branch.flatMap((id) => [id, ...descendantsOf(allGroups, id)]));
    groups = allGroups.filter((g) => inBranch.has(g.id));
    allTeams = orgTeams.filter((t) => t.groupId != null && inBranch.has(t.groupId));
  }
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
      points: m.points,
      teamRank: null,
    };
    const bucket = peopleByTeam.get(m.teamId) ?? { staff: [], players: [] };
    (m.role === "PLAYER" ? bucket.players : bucket.staff).push(person);
    peopleByTeam.set(m.teamId, bucket);
  }
  for (const bucket of peopleByTeam.values()) {
    bucket.staff.sort((a, b) => a.roleRank - b.roleRank || a.name.localeCompare(b.name));
    const board = rank1224([...bucket.players].sort((a, b) => b.points - a.points));
    const places = new Map(board.map((p) => [p.userId, p.rank]));
    for (const p of bucket.players) p.teamRank = places.get(p.userId) ?? null;
    bucket.players.sort((a, b) => b.careerPoints - a.careerPoints || a.name.localeCompare(b.name));
  }

  const teams: OrgViewTeam[] = allTeams.map((t) => {
    const people = peopleByTeam.get(t.id) ?? { staff: [], players: [] };
    return { ...t, ...people, playerCount: people.players.length };
  });

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
    groups,
    teams,
    totals,
  };
}
