import { prisma } from "./prisma";

// ORG STRUCTURE (grouping Chunk 1): Organization → Program → Division → Team.
// These are GROUPING layers for display and rollups only — no permission
// check ever traverses them (authorization stays anchored on organizationId;
// see lib/authz.ts, unchanged).
//
// PROGRESSIVE DISCLOSURE is a DISPLAY RULE computed here, never a data rule:
// the layers always exist underneath (every org has at least a default
// Program/Division from the backfill or signup), but any layer with a single
// entry is hidden by consumers — a small club never sees or names structure
// it doesn't have, a multi-program academy sees the full tree.

export type OrgStructure = Awaited<ReturnType<typeof getOrgStructure>>;

export async function getOrgStructure(organizationId: number) {
  const [programs, unassignedTeams] = await Promise.all([
    prisma.program.findMany({
      where: { organizationId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: {
        divisions: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          include: {
            teams: {
              orderBy: { name: "asc" },
              select: { id: true, name: true, joinCode: true, logoUrl: true },
            },
          },
        },
      },
    }),
    // Transition tolerance: teams the structure backfill hasn't reached yet.
    prisma.team.findMany({
      where: { organizationId, divisionId: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, joinCode: true, logoUrl: true },
    }),
  ]);

  return {
    programs: programs.map((p) => ({
      ...p,
      // Hide the division layer inside a program that has only one.
      showDivisions: p.divisions.length > 1,
    })),
    unassignedTeams,
    // Hide the program layer when the org has only one.
    showPrograms: programs.length > 1,
  };
}
