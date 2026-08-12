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

// SEASON ROLLOVER (Stage 4f; E.9 ruling): retire the current season, open the
// next, and CARRY STAFF memberships forward — players re-join by code each
// season (their old memberships simply stop being current; nothing is ended
// or deleted, and career points/journals carry on the person). One
// transaction; the one-current-season invariant holds throughout.
export function rolloverSeason(organizationId: number, name: string) {
  return prisma.$transaction(async (tx) => {
    const staff = await tx.membership.findMany({
      where: {
        endedAt: null,
        role: { not: "PLAYER" },
        season: { organizationId, isCurrent: true },
        team: { organizationId },
      },
      select: { profileId: true, teamId: true, role: true, jerseyNumber: true },
    });
    await tx.season.updateMany({
      where: { organizationId, isCurrent: true },
      data: { isCurrent: false },
    });
    const season = await tx.season.create({
      data: { organizationId, name, isCurrent: true },
    });
    for (const m of staff) {
      await tx.membership.create({ data: { ...m, seasonId: season.id } });
    }
    return { season, staffCarried: staff.length };
  });
}
