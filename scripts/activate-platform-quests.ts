/**
 * ACTIVATE THE ELITE24 QUEST SET (person-first plan, Phase 1, 2026-10-09).
 *
 * Two fixes, one transaction:
 *
 *   1. The shared quests (organizationId = null) come back on as the
 *      ELITE24 QUEST SET — what an athlete with no team (Personal Player
 *      Development) is served. The Stage 4a converge retired them when every
 *      org got its own copies; org players are unaffected, because
 *      lib/quests serves an org's own active set whenever it has one.
 *   2. Any org with NO active quests gets its copies turned on. Sign-up used
 *      to copy them switched off (written for the pre-converge world), so
 *      every org created since the converge showed an empty Quests page.
 *
 * Idempotent: a re-run finds nothing to change.
 *
 *   npx tsx scripts/activate-platform-quests.ts            → dry-run report
 *   BACKFILL_CONFIRM=<db host> ... --execute               → apply
 *   npx tsx scripts/activate-platform-quests.ts --verify   → post-state checks
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

// Orgs whose players would see an empty Quests page: no active quests of
// their own (they fall back to the shared set, which may be off).
async function orgsWithoutActiveQuests(db: PrismaClient) {
  const orgs = await db.organization.findMany({
    select: {
      id: true,
      name: true,
      _count: { select: { quests: { where: { active: true } } } },
      quests: { select: { id: true } },
    },
  });
  return orgs
    .filter((o) => o._count.quests === 0)
    .map((o) => ({ id: o.id, name: o.name, copies: o.quests.length }));
}

export async function activatePlatformQuests(db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    const elite24 = (
      await tx.quest.updateMany({
        where: { organizationId: null, active: false },
        data: { active: true },
      })
    ).count;
    let orgCopies = 0;
    for (const org of await orgsWithoutActiveQuests(tx as unknown as PrismaClient)) {
      orgCopies += (
        await tx.quest.updateMany({
          where: { organizationId: org.id, active: false },
          data: { active: true },
        })
      ).count;
    }
    return { elite24, orgCopies };
  });
}

async function report() {
  const [activeShared, totalShared, emptyOrgs] = await Promise.all([
    prisma.quest.count({ where: { organizationId: null, active: true } }),
    prisma.quest.count({ where: { organizationId: null } }),
    orgsWithoutActiveQuests(prisma),
  ]);
  console.log(`STATE against ${hostOf(process.env.DATABASE_URL)}`);
  console.log(`  Elite24 quest set (shared): ${activeShared} of ${totalShared} active`);
  console.log(`  Orgs with no active quests: ${emptyOrgs.length}`);
  for (const o of emptyOrgs) console.log(`    - ${o.name} (#${o.id}): ${o.copies} switched-off copies`);
  const ok = totalShared > 0 && activeShared === totalShared && emptyOrgs.every((o) => o.copies === 0);
  console.log(ok ? "  => OK" : "  => NEEDS --execute");
  return ok;
}

async function main() {
  const mode = process.argv.includes("--execute")
    ? "execute"
    : process.argv.includes("--verify")
      ? "verify"
      : "dry-run";

  if (mode === "dry-run") {
    await report();
    console.log("\nDry run only. --execute turns the quests on.");
  } else if (mode === "verify") {
    process.exitCode = (await report()) ? 0 : 1;
  } else {
    requireConfirm();
    const r = await activatePlatformQuests();
    console.log(`ACTIVATED: ${r.elite24} Elite24 quests, ${r.orgCopies} org quest copies`);
    await report();
  }
}

// CLI entry — skipped when the test suite imports the functions above.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/activate-platform-quests.ts")) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
