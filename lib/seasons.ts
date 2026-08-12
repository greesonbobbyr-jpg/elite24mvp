import { prisma } from "./prisma";

// "Exactly one current season per organization" is app-enforced (Prisma can't
// express a partial unique index), so this transaction is the ONLY sanctioned
// way to open a season: retire the current one and create the successor
// atomically. The invariant is owned by tests/season-invariant.test.ts.
// (Season rollover UI arrives at Stage 4f; the Stage 1 backfill created each
// org's first season directly because none could exist yet.)
export function startNewSeason(
  organizationId: number,
  name: string,
  dates?: { startDate?: Date; endDate?: Date },
) {
  return prisma.$transaction(async (tx) => {
    await tx.season.updateMany({
      where: { organizationId, isCurrent: true },
      data: { isCurrent: false },
    });
    return tx.season.create({
      data: { organizationId, name, isCurrent: true, ...dates },
    });
  });
}
