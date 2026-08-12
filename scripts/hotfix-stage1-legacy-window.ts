/**
 * STAGE 1 HOTFIX — make the backfill invisible to the still-running legacy app.
 *
 * The first backfill run left two things the legacy read paths can see:
 *   1. Org quest clones were created with active=true → the legacy quest page
 *      (lib/quests.ts listActiveQuests: WHERE active) listed 18 quests, not 6.
 *      Fix: clones are inactive until the Stage 4a cutover flips them.
 *   2. TODAY's quest logs were re-pointed to clone ids → the legacy page (which
 *      matches today's logs against GLOBAL quest ids) showed them incomplete
 *      and would let a player complete the same quest twice.
 *      Fix: point today's logs back at their global quest; historical logs stay
 *      on clones (nothing in the legacy app looks up history by quest id).
 *      If a player already double-completed, the duplicate global log + its
 *      ledger row are removed and the legacy points cache is corrected.
 *
 *   BACKFILL_CONFIRM=<db host> npx tsx scripts/hotfix-stage1-legacy-window.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DAY_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: process.env.APP_TIMEZONE ?? "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const today = DAY_FMT.format(new Date());

function hostOf(url: string | undefined): string {
  try {
    return new URL(url ?? "").hostname;
  } catch {
    return "";
  }
}

async function main() {
  const host = hostOf(process.env.DATABASE_URL);
  if (process.env.BACKFILL_CONFIRM !== host) {
    console.error(`Refusing to run. Set BACKFILL_CONFIRM=${host} to confirm.`);
    process.exit(1);
  }
  console.log(`HOTFIX against ${host} (today=${today})\n`);

  // 1. Hide the clones from the legacy quest list until cutover.
  const deactivated = await prisma.quest.updateMany({
    where: { organizationId: { not: null }, active: true },
    data: { active: false },
  });
  console.log(`Clones deactivated: ${deactivated.count}`);

  // 2. Re-point TODAY's logs back to their global quest.
  const globals = await prisma.quest.findMany({ where: { organizationId: null } });
  const globalByTitle = new Map(globals.map((q) => [q.title, q.id]));
  const todayCloneLogs = await prisma.questLog.findMany({
    where: { day: today, quest: { organizationId: { not: null } } },
    include: { quest: true, pointsLedger: true },
  });
  console.log(`Today's logs sitting on clones: ${todayCloneLogs.length}`);

  let reverted = 0;
  let dupesRemoved = 0;
  for (const log of todayCloneLogs) {
    const globalId = globalByTitle.get(log.quest.title);
    if (!globalId) {
      console.error(`  !! no global quest titled ${JSON.stringify(log.quest.title)} — skipping log ${log.id}`);
      continue;
    }
    await prisma.$transaction(async (tx) => {
      // A duplicate means the player re-completed on the global id after the
      // backfill — the clone log is the ORIGINAL; the global one is the dupe.
      const dupe = await tx.questLog.findUnique({
        where: { userId_questId_day: { userId: log.userId, questId: globalId, day: today } },
        include: { pointsLedger: true },
      });
      if (dupe) {
        if (dupe.pointsLedger) {
          await tx.pointsLedger.delete({ where: { id: dupe.pointsLedger.id } });
          await tx.playerProfile.update({
            where: { userId: dupe.userId },
            data: { points: { decrement: dupe.pointsLedger.amount } },
          });
          console.log(`  duplicate completion removed: user ${dupe.userId}, quest ${JSON.stringify(log.quest.title)}, -${dupe.pointsLedger.amount} pts`);
        }
        await tx.questLog.delete({ where: { id: dupe.id } });
        dupesRemoved++;
      }
      await tx.questLog.update({ where: { id: log.id }, data: { questId: globalId } });
      reverted++;
    });
  }
  console.log(`Today's logs reverted to global ids: ${reverted}`);
  console.log(`Duplicate completions removed: ${dupesRemoved}`);

  // Final state the legacy app sees.
  const activeCount = await prisma.quest.count({ where: { active: true } });
  const activeClones = await prisma.quest.count({
    where: { active: true, organizationId: { not: null } },
  });
  const todayOnClones = await prisma.questLog.count({
    where: { day: today, quest: { organizationId: { not: null } } },
  });
  console.log(`\nLegacy view now: active quests=${activeCount} (clones among them: ${activeClones}), today's logs on clones: ${todayOnClones}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
