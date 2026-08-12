/**
 * STAGE 4a QUEST CONVERGE — the deliberate, atomic flip from global quests to
 * org-owned clones. This is the one moment in the migration that changes what
 * a legacy read returns, BY DESIGN, and it is safe for the legacy app on its
 * own (see HIERARCHY_PLAN.md Stage 4a):
 *
 *   - The legacy quest page renders whatever ACTIVE quests exist and
 *     round-trips their ids through its forms. After the flip it lists the
 *     org's clones — identical titles/points/order — and today's logs (moved
 *     in the same transaction) match those clone ids, so completion state is
 *     right on the very next render.
 *   - A page rendered BEFORE the flip holds global ids; acting on them AFTER
 *     the flip hits `!quest.active` guards / miss-lookups and no-ops
 *     harmlessly, then revalidates into the correct state. No double awards
 *     (creates with a stale global id are blocked by the inactive guard).
 *
 * Everything happens in ONE transaction, so no request ever observes a
 * half-flipped state.
 *
 *   npx tsx scripts/converge-quests.ts              → dry-run report
 *   BACKFILL_CONFIRM=<db host> ... --execute        → the flip
 *   BACKFILL_CONFIRM=<db host> ... --rollback       → the one-command undo
 *   npx tsx scripts/converge-quests.ts --verify     → post-state checks
 *
 * Run `backfill-hierarchy.ts --execute` FIRST (idempotent) so every row
 * created since the last run is stamped before the flip.
 */
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

const DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: process.env.APP_TIMEZONE ?? "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

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

// THE FLIP. Atomic: re-point every remaining global-id quest log to its org's
// clone, activate the clones (inheriting each global's current active value),
// retire the globals. Idempotent — a re-run finds nothing to change.
export async function convergeQuests(db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    const globals = await tx.quest.findMany({ where: { organizationId: null } });
    const clones = await tx.quest.findMany({ where: { organizationId: { not: null } } });
    const cloneByOrgTitle = new Map(clones.map((c) => [`${c.organizationId}:${c.title}`, c]));

    // Any log on a global quest whose user's team has no org cannot be mapped —
    // abort rather than leave it stranded (backfill re-run fixes the team).
    const unmappable = await tx.questLog.count({
      where: { quest: { organizationId: null }, user: { team: { organizationId: null } } },
    });
    if (unmappable > 0) {
      throw new Error(
        `${unmappable} quest logs belong to teams with no organization — run backfill-hierarchy --execute first.`,
      );
    }

    let repointed = 0;
    // Only orgs that HAVE teams can own quest logs (a team-less org — e.g. a
    // test artifact — has nothing to converge and needs no clones).
    const orgs = await tx.organization.findMany({
      where: { teams: { some: {} } },
      select: { id: true },
    });
    for (const org of orgs) {
      for (const gq of globals) {
        const clone = cloneByOrgTitle.get(`${org.id}:${gq.title}`);
        if (!clone) {
          throw new Error(
            `Org ${org.id} has no clone of ${JSON.stringify(gq.title)} — run backfill-hierarchy --execute first.`,
          );
        }
        repointed += (
          await tx.questLog.updateMany({
            where: { questId: gq.id, user: { team: { organizationId: org.id } } },
            data: { questId: clone.id },
          })
        ).count;
      }
    }

    // Clones inherit each global's active value — but ONLY while the globals
    // still carry the truth (pre-flip). Once converged, the truth lives on
    // the clones and a re-run must not touch actives (idempotent). From a
    // pathological all-dark state, activate all clones (restore service).
    const activeGlobals = globals.filter((g) => g.active).length;
    const activeClones = clones.filter((c) => c.active).length;
    let activated = 0;
    let retired = 0;
    if (activeGlobals > 0) {
      for (const gq of globals) {
        activated += (
          await tx.quest.updateMany({
            where: { organizationId: { not: null }, title: gq.title, active: { not: gq.active } },
            data: { active: gq.active },
          })
        ).count;
      }
      retired = (
        await tx.quest.updateMany({
          where: { organizationId: null, active: true },
          data: { active: false },
        })
      ).count;
    } else if (activeClones === 0) {
      activated = (
        await tx.quest.updateMany({
          where: { organizationId: { not: null }, active: false },
          data: { active: true },
        })
      ).count;
    }

    return { repointed, activated, retired };
  });
}

// THE ONE-COMMAND UNDO. Atomic mirror of the flip: reactivate each global from
// its clones' state, deactivate all clones, and move TODAY's logs back to
// global ids so the legacy page matches completions again. (Historical logs
// stay on clones — the legacy app never looks up history by quest id.)
export async function rollbackQuests(db: PrismaClient = prisma) {
  const today = DAY_FMT.format(new Date());
  return db.$transaction(async (tx) => {
    const globals = await tx.quest.findMany({ where: { organizationId: null } });
    const activeClones = await tx.quest.count({
      where: { organizationId: { not: null }, active: true },
    });
    const activeGlobals = globals.filter((g) => g.active).length;

    // State-aware: the truth about active flags lives on the clones ONLY when
    // the system is converged. From the legacy state this is a no-op on the
    // globals; from a pathological all-dark state it restores full service.
    let reactivated = 0;
    if (activeClones > 0) {
      for (const gq of globals) {
        const clone = await tx.quest.findFirst({
          where: { organizationId: { not: null }, title: gq.title },
          select: { active: true },
        });
        const shouldBeActive = clone?.active ?? true;
        if (gq.active !== shouldBeActive) {
          await tx.quest.update({ where: { id: gq.id }, data: { active: shouldBeActive } });
          reactivated++;
        }
      }
    } else if (activeGlobals === 0) {
      reactivated = (
        await tx.quest.updateMany({
          where: { organizationId: null, active: false },
          data: { active: true },
        })
      ).count;
    }
    const deactivated = (
      await tx.quest.updateMany({
        where: { organizationId: { not: null }, active: true },
        data: { active: false },
      })
    ).count;

    // Today's logs return to global ids (per-pair; creates with global ids
    // were blocked while globals were inactive, so no unique conflicts).
    let repointed = 0;
    const clones = await tx.quest.findMany({ where: { organizationId: { not: null } } });
    const globalByTitle = new Map(globals.map((g) => [g.title, g.id]));
    for (const clone of clones) {
      const globalId = globalByTitle.get(clone.title);
      if (globalId == null) continue;
      repointed += (
        await tx.questLog.updateMany({
          where: { questId: clone.id, day: { gte: today } },
          data: { questId: globalId },
        })
      ).count;
    }

    return { reactivated, deactivated, repointed };
  });
}

async function report() {
  const [activeGlobals, activeClones, logsOnGlobals, logsOnGlobalsToday] = await Promise.all([
    prisma.quest.count({ where: { organizationId: null, active: true } }),
    prisma.quest.count({ where: { organizationId: { not: null }, active: true } }),
    prisma.questLog.count({ where: { quest: { organizationId: null } } }),
    prisma.questLog.count({
      where: { quest: { organizationId: null }, day: { gte: DAY_FMT.format(new Date()) } },
    }),
  ]);
  console.log(`STATE against ${hostOf(process.env.DATABASE_URL)}`);
  console.log(`  Active global quests:      ${activeGlobals}`);
  console.log(`  Active org clones:         ${activeClones}`);
  console.log(`  Logs on global quests:     ${logsOnGlobals} (today: ${logsOnGlobalsToday})`);
  const converged = activeGlobals === 0 && activeClones > 0 && logsOnGlobals === 0;
  console.log(converged ? "  => CONVERGED" : "  => LEGACY (not converged)");
  return converged;
}

async function main() {
  const mode = process.argv.includes("--execute")
    ? "execute"
    : process.argv.includes("--rollback")
      ? "rollback"
      : process.argv.includes("--verify")
        ? "verify"
        : "dry-run";

  if (mode === "dry-run") {
    await report();
    console.log("\nDry run only. --execute flips to org quests; --rollback undoes it.");
  } else if (mode === "verify") {
    const converged = await report();
    process.exitCode = converged ? 0 : 1;
  } else if (mode === "execute") {
    requireConfirm();
    const r = await convergeQuests();
    console.log(`CONVERGED: re-pointed ${r.repointed} logs, activated ${r.activated} clones, retired ${r.retired} globals`);
    await report();
  } else {
    requireConfirm();
    const r = await rollbackQuests();
    console.log(`ROLLED BACK: reactivated ${r.reactivated} globals, deactivated ${r.deactivated} clones, re-pointed ${r.repointed} today-logs`);
    await report();
  }
}

// CLI entry — skipped when the test suite imports the functions above.
if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/converge-quests.ts")) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
