/**
 * GROUPING CHUNK 1 — structure backfill (idempotent, additive data only).
 *
 * Every org gets a default Program "Main" with a default Division "Main", and
 * every team with no division is assigned to its own org's default. The
 * defaults are renameable in the org UI and hidden by progressive disclosure
 * until a second sibling exists — a small club never sees them.
 *
 *   npx tsx scripts/backfill-structure.ts             → DRY RUN (report only)
 *   BACKFILL_CONFIRM=<db host> ... --execute          → run (one transaction)
 *   npx tsx scripts/backfill-structure.ts --verify    → invariants report
 *
 * Idempotent: find-else-create keyed on (organizationId, name) / (programId,
 * name); assignment is `updateMany WHERE divisionId IS NULL`. A second
 * --execute creates and assigns nothing.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const MODE = process.argv.includes("--execute")
  ? "execute"
  : process.argv.includes("--verify")
    ? "verify"
    : "dry-run";

const DEFAULT_NAME = "Main";

function hostOf(url: string | undefined): string {
  try {
    return new URL(url ?? "").hostname;
  } catch {
    return "";
  }
}

async function report() {
  const [orgs, programs, divisions, teams, unassigned] = await Promise.all([
    prisma.organization.count(),
    prisma.program.count(),
    prisma.division.count(),
    prisma.team.count({ where: { organizationId: { not: null } } }),
    prisma.team.count({ where: { organizationId: { not: null }, divisionId: null } }),
  ]);
  console.log(`STATE against ${hostOf(process.env.DATABASE_URL)}`);
  console.log(`  Organizations: ${orgs} · Programs: ${programs} · Divisions: ${divisions}`);
  console.log(`  Teams (with org): ${teams} · without a division: ${unassigned}`);
  return { orgs, programs, divisions, teams, unassigned };
}

async function execute() {
  const host = hostOf(process.env.DATABASE_URL);
  if (process.env.BACKFILL_CONFIRM !== host) {
    console.error(
      `Refusing to execute. This WRITES to:\n\n    ${host}\n\nIf intended, re-run with BACKFILL_CONFIRM=${host}\n`,
    );
    process.exit(1);
  }

  const result = await prisma.$transaction(async (tx) => {
    let programsCreated = 0;
    let divisionsCreated = 0;
    let teamsAssigned = 0;

    const orgs = await tx.organization.findMany({ select: { id: true } });
    for (const org of orgs) {
      let program = await tx.program.findFirst({
        where: { organizationId: org.id },
        orderBy: { sortOrder: "asc" },
      });
      if (!program) {
        program = await tx.program.create({
          data: { organizationId: org.id, name: DEFAULT_NAME },
        });
        programsCreated++;
      }
      let division = await tx.division.findFirst({
        where: { program: { organizationId: org.id } },
        orderBy: { sortOrder: "asc" },
      });
      if (!division) {
        division = await tx.division.create({
          data: { programId: program.id, name: DEFAULT_NAME },
        });
        divisionsCreated++;
      }
      teamsAssigned += (
        await tx.team.updateMany({
          where: { organizationId: org.id, divisionId: null },
          data: { divisionId: division.id },
        })
      ).count;
    }
    return { programsCreated, divisionsCreated, teamsAssigned };
  });

  console.log(`EXECUTED against ${host}`);
  console.log(`  Programs created:  ${result.programsCreated}`);
  console.log(`  Divisions created: ${result.divisionsCreated}`);
  console.log(`  Teams assigned:    ${result.teamsAssigned}`);
  if (Object.values(result).every((n) => n === 0)) {
    console.log("  Nothing to do — structure already complete (idempotent re-run).");
  }
  await report();
}

async function verify() {
  let failures = 0;
  const ok = (cond: boolean, label: string, detail = "") => {
    console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    if (!cond) failures++;
  };

  const state = await report();
  ok(state.programs >= state.orgs, "Every org has at least one program",
    `${state.programs} programs / ${state.orgs} orgs`);
  const orgsWithoutProgram = await prisma.organization.count({
    where: { programs: { none: {} } },
  });
  ok(orgsWithoutProgram === 0, "No org without a program");
  const programsWithoutDivision = await prisma.program.count({
    where: { divisions: { none: {} } },
  });
  // A program may legitimately be empty later; the backfill guarantees each
  // ORG has at least one division somewhere.
  const orgsWithoutDivision = await prisma.organization.count({
    where: { programs: { every: { divisions: { none: {} } } } },
  });
  ok(orgsWithoutDivision === 0, "Every org has at least one division",
    `${programsWithoutDivision} empty programs (allowed)`);
  ok(state.unassigned === 0, "Every team (with an org) has a division");

  // Chain consistency: a team's division must belong to the team's own org.
  const teams = await prisma.team.findMany({
    where: { divisionId: { not: null } },
    select: {
      id: true,
      name: true,
      organizationId: true,
      division: { select: { program: { select: { organizationId: true } } } },
    },
  });
  const crossed = teams.filter(
    (t) => t.division!.program.organizationId !== t.organizationId,
  );
  ok(crossed.length === 0, "Team → division → program → org chains are consistent",
    crossed.length ? crossed.map((t) => t.name).join(", ") : `${teams.length} teams checked`);

  console.log(failures === 0 ? "\nALL STRUCTURE CHECKS PASS" : `\n${failures} FAILURES`);
  if (failures > 0) process.exitCode = 1;
}

(MODE === "execute" ? execute() : MODE === "verify" ? verify() : report().then(() => {
  console.log("\nDry run only. --execute creates defaults + assigns teams.");
}))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
