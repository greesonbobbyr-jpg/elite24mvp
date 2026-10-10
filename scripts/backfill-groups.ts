/**
 * BACKFILL THE GROUP TREE (person-first plan Phase 2, 2026-10-09).
 *
 * Program → Division → Team becomes the group tree:
 *   - each Program becomes a top-level Group (kind PROGRAM)
 *   - each Division becomes a Group inside its program's (kind DIVISION)
 *   - each Team moves into its division's group
 * A lone default "Main" makes NO group: an org's only program named "Main",
 * or a program's only division named "Main" — that's the hidden skeleton
 * sign-up used to create, so a one-team org stays exactly as it looks today
 * (its team sits directly under the organization).
 *
 * Idempotent: groups are keyed by legacyProgramId / legacyDivisionId, and a
 * team that already has a group is left alone. Program/Division stay in place
 * (read by nothing) until the Phase 6 cleanup.
 *
 *   npx tsx scripts/backfill-groups.ts              → dry-run report
 *   BACKFILL_CONFIRM=<db host> ... --execute        → apply
 *   npx tsx scripts/backfill-groups.ts --verify     → post-state checks
 */
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

function hostOf(url: string | undefined): string {
  try {
    return new URL(url ?? "").hostname;
  } catch {
    return "";
  }
}

function requireConfirm() {
  const host = hostOf(process.env.DATABASE_URL);
  if (process.env.BACKFILL_CONFIRM !== host) {
    console.error(
      `Refusing to run. This WRITES to:\n\n    ${host}\n\nIf intended, re-run with BACKFILL_CONFIRM=${host}\n`,
    );
    process.exit(1);
  }
}

const isMain = (name: string) => name.trim().toLowerCase() === "main";

type Legacy = Awaited<ReturnType<typeof loadLegacy>>;

async function loadLegacy(db: PrismaClient) {
  return db.organization.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      programs: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          sortOrder: true,
          divisions: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: { id: true, name: true, sortOrder: true, teams: { select: { id: true, groupId: true } } },
          },
        },
      },
    },
  });
}

/** Which legacy rows become groups. */
export function shapeOf(org: Legacy[number]) {
  const programs = org.programs.map((p) => ({
    program: p,
    makeGroup: !(org.programs.length === 1 && isMain(p.name)),
    divisions: p.divisions.map((d) => ({
      division: d,
      makeGroup: !(p.divisions.length === 1 && isMain(d.name)),
    })),
  }));
  return programs;
}

export async function planBackfill(db: PrismaClient = prisma) {
  const orgs = await loadLegacy(db);
  const [byProgram, byDivision] = await Promise.all([
    db.group.findMany({ where: { legacyProgramId: { not: null } }, select: { legacyProgramId: true } }),
    db.group.findMany({ where: { legacyDivisionId: { not: null } }, select: { legacyDivisionId: true } }),
  ]);
  const doneP = new Set(byProgram.map((g) => g.legacyProgramId));
  const doneD = new Set(byDivision.map((g) => g.legacyDivisionId));
  let groupsToCreate = 0;
  let teamsToMove = 0;
  const lines: string[] = [];
  for (const org of orgs) {
    let orgGroups = 0;
    let orgTeams = 0;
    for (const p of shapeOf(org)) {
      if (p.makeGroup && !doneP.has(p.program.id)) orgGroups++;
      for (const d of p.divisions) {
        if (d.makeGroup && !doneD.has(d.division.id)) orgGroups++;
        if (p.makeGroup || d.makeGroup) orgTeams += d.division.teams.filter((t) => t.groupId == null).length;
      }
    }
    groupsToCreate += orgGroups;
    teamsToMove += orgTeams;
    lines.push(`  ${org.name} (#${org.id}): ${orgGroups} groups to create, ${orgTeams} teams to move into them`);
  }
  return { groupsToCreate, teamsToMove, lines };
}

export async function executeBackfill(db: PrismaClient = prisma) {
  const before = await planBackfill(db);
  const orgs = await loadLegacy(db);
  let moved = 0;
  await db.$transaction(async (tx) => {
    for (const org of orgs) {
      for (const p of shapeOf(org)) {
        let programGroupId: number | null = null;
        if (p.makeGroup) {
          const g = await tx.group.upsert({
            where: { legacyProgramId: p.program.id },
            update: {},
            create: {
              organizationId: org.id,
              name: p.program.name,
              kind: "PROGRAM",
              depth: 1,
              sortOrder: p.program.sortOrder,
              legacyProgramId: p.program.id,
            },
          });
          programGroupId = g.id;
        }
        for (const d of p.divisions) {
          let target = programGroupId;
          if (d.makeGroup) {
            const g = await tx.group.upsert({
              where: { legacyDivisionId: d.division.id },
              update: {},
              create: {
                organizationId: org.id,
                parentId: programGroupId,
                name: d.division.name,
                kind: "DIVISION",
                depth: programGroupId == null ? 1 : 2,
                sortOrder: d.division.sortOrder,
                legacyDivisionId: d.division.id,
              },
            });
            target = g.id;
          }
          if (target == null) continue;
          const ids = d.division.teams.filter((t) => t.groupId == null).map((t) => t.id);
          if (ids.length) {
            moved += (await tx.team.updateMany({ where: { id: { in: ids }, groupId: null }, data: { groupId: target } })).count;
          }
        }
      }
    }
  });
  const after = await planBackfill(db);
  return { created: before.groupsToCreate - after.groupsToCreate, moved, plan: after };
}

/** Post-state checks; returns the failures (empty = OK). */
export async function verifyBackfill(db: PrismaClient = prisma): Promise<string[]> {
  const failures: string[] = [];
  const orgs = await loadLegacy(db);
  const groups = await db.group.findMany({
    select: { id: true, organizationId: true, parentId: true, depth: true, legacyProgramId: true, legacyDivisionId: true },
  });
  const byId = new Map(groups.map((g) => [g.id, g]));
  const byProgram = new Map(groups.filter((g) => g.legacyProgramId != null).map((g) => [g.legacyProgramId!, g]));
  const byDivision = new Map(groups.filter((g) => g.legacyDivisionId != null).map((g) => [g.legacyDivisionId!, g]));

  for (const org of orgs) {
    for (const p of shapeOf(org)) {
      if (p.makeGroup && !byProgram.has(p.program.id)) failures.push(`program #${p.program.id} has no group`);
      for (const d of p.divisions) {
        if (d.makeGroup && !byDivision.has(d.division.id)) failures.push(`division #${d.division.id} has no group`);
        const expected = byDivision.get(d.division.id)?.id ?? byProgram.get(p.program.id)?.id ?? null;
        if (expected == null) continue;
        for (const t of d.division.teams) {
          if (t.groupId == null) failures.push(`team #${t.id} isn't in a group (expected #${expected})`);
        }
      }
    }
  }
  for (const g of groups) {
    const parent = g.parentId == null ? null : byId.get(g.parentId);
    if (g.parentId != null && !parent) failures.push(`group #${g.id}: parent missing`);
    if (parent && parent.organizationId !== g.organizationId) failures.push(`group #${g.id}: parent in another org`);
    if ((parent ? parent.depth + 1 : 1) !== g.depth) failures.push(`group #${g.id}: depth ${g.depth} is wrong`);
    if (g.depth > 4) failures.push(`group #${g.id}: deeper than 4`);
  }
  const strays = await db.team.findMany({
    where: { groupId: { not: null } },
    select: { id: true, organizationId: true, group: { select: { organizationId: true } } },
  });
  for (const t of strays) {
    if (t.group && t.group.organizationId !== t.organizationId) failures.push(`team #${t.id}: group in another org`);
  }
  return failures;
}

async function main() {
  const mode = process.argv.includes("--execute") ? "execute" : process.argv.includes("--verify") ? "verify" : "dry-run";
  console.log(`GROUP TREE BACKFILL against ${hostOf(process.env.DATABASE_URL)}`);
  if (mode === "verify") {
    const failures = await verifyBackfill();
    console.log(failures.length ? failures.map((f) => `  FAIL ${f}`).join("\n") : "  all checks pass");
    process.exitCode = failures.length ? 1 : 0;
    return;
  }
  const plan = await planBackfill();
  console.log(plan.lines.join("\n"));
  if (mode === "dry-run") {
    console.log(`\nDry run: ${plan.groupsToCreate} groups, ${plan.teamsToMove} teams. --execute applies it.`);
    return;
  }
  requireConfirm();
  const r = await executeBackfill();
  console.log(`\nDONE: created ${r.created} groups, moved ${r.moved} teams. Left to do: ${r.plan.groupsToCreate} groups, ${r.plan.teamsToMove} teams (0 = complete).`);
  const failures = await verifyBackfill();
  console.log(failures.length ? failures.map((f) => `  FAIL ${f}`).join("\n") : "  verify: all checks pass");
  process.exitCode = failures.length ? 1 : 0;
}

// CLI entry — skipped when the test suite imports the functions above.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/backfill-groups.ts")) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
