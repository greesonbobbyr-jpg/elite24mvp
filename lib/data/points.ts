import { Prisma, PointsSource, type Quest } from "@prisma/client";
import { prisma } from "../prisma";
import { advanceStreak } from "../streaks";
import { createMyEntryInTx, createMyReviewOp } from "./reflections";

// THE points write paths. Every transaction here writes the ledger row and,
// in the SAME transaction, the caches that sum it:
//   Profile.careerPoints  == Σ ledger by profileId    (the person; card tier)
//   Membership.points     == Σ ledger by membershipId (the team board)
// Rows are stamped with the person (profileId) and, when the person is acting
// on a team, that membership.
//
// No-team ruling (owner, 2026-10-09): every player-earned source — check-in,
// review, AND quests — stamps the person, with NULL membershipId when there
// is no active membership. An athlete with no team (Personal Player
// Development, or between teams) earns career points from quests like anyone
// else; only the team board needs a membership. Coach adjustments only exist
// on a roster.
//
// Undo reverses BY THE LEDGER ROW'S OWN STAMPS, never the current ctx, so an
// award is always reversed exactly where it landed.

// The slice of ctx these writes need. lib/context's Ctx satisfies it.
export type WriteCtx = {
  user: { id: number };
  profile: { id: number };
  membership: { id: number } | null;
};

type Stamps = { profileId: number | null; membershipId: number | null };

// Bump careerPoints (+ membership points when stamped) inside a transaction.
async function bumpCaches(tx: Prisma.TransactionClient, stamps: Stamps, amount: number) {
  if (stamps.profileId != null) {
    await tx.profile.update({
      where: { id: stamps.profileId },
      data: { careerPoints: { increment: amount } },
    });
  }
  if (stamps.membershipId != null) {
    await tx.membership.update({
      where: { id: stamps.membershipId },
      data: { points: { increment: amount } },
    });
  }
}

// Stamps for player-earned sources (check-in / review / quests): the person
// always, the membership when there is one (no-team ruling).
function personStamps(ctx: WriteCtx) {
  return { profileId: ctx.profile.id, membershipId: ctx.membership?.id ?? null };
}

// Daily check-in: JournalEntry + ledger + caches + streak, one transaction.
// Throws P2002 when already checked in today (caller treats as no-op success).
export async function performCheckIn(
  ctx: WriteCtx,
  reflection: string,
  day: string,
  pointsPerCheckIn: number,
) {
  const stamps = personStamps(ctx);
  await prisma.$transaction(async (tx) => {
    await createMyEntryInTx(tx, ctx, reflection, day);
    await tx.pointsLedger.create({
      data: {
        userId: ctx.user.id,
        amount: pointsPerCheckIn,
        reason: "Daily check-in",
        source: PointsSource.DAILY_CHECK_IN,
        ...stamps,
      },
    });
    // Advance the streak in the same transaction as the entry (the unique
    // [userId, day] on JournalEntry guarantees this runs once per day). The
    // streak follows the PERSON.
    const profile = await tx.profile.findUniqueOrThrow({
      where: { id: ctx.profile.id },
      select: {
        currentStreak: true,
        bestStreak: true,
        lastCheckInDay: true,
        streakGraceUsed: true,
      },
    });
    await tx.profile.update({
      where: { id: ctx.profile.id },
      data: { ...advanceStreak(profile, day) },
    });
    await bumpCaches(tx, stamps, pointsPerCheckIn);
  });
}

// Evening Pro Review: review + ledger + caches, one transaction.
// Throws P2002 when already reviewed today (caller treats as no-op success).
export async function performReview(
  ctx: WriteCtx,
  data: {
    day: string;
    outcome: "YES" | "PARTIAL" | "NO";
    learned: string;
    noteToTomorrow: string | null;
  },
  pointsPerReview: number,
) {
  const stamps = personStamps(ctx);
  // An ARRAY transaction (createMyReviewOp returns the unexecuted create),
  // with the cache ops in the same commit.
  const ops: Prisma.PrismaPromise<unknown>[] = [
    createMyReviewOp(ctx, data),
    prisma.pointsLedger.create({
      data: {
        userId: ctx.user.id,
        amount: pointsPerReview,
        reason: "Pro Review",
        source: PointsSource.REVIEW,
        ...stamps,
      },
    }),
    prisma.profile.update({
      where: { id: stamps.profileId },
      data: { careerPoints: { increment: pointsPerReview } },
    }),
  ];
  if (stamps.membershipId != null) {
    ops.push(
      prisma.membership.update({
        where: { id: stamps.membershipId },
        data: { points: { increment: pointsPerReview } },
      }),
    );
  }
  await prisma.$transaction(ops);
}

// One-tap quest completion (no targetCount). Throws P2002 when already logged.
export async function performOneTapQuest(ctx: WriteCtx, quest: Quest, day: string) {
  const stamps = personStamps(ctx);
  // Interactive transaction so the ledger row can link back to the created
  // QuestLog (questLogId) — undo uses that link to reverse the exact row.
  await prisma.$transaction(async (tx) => {
    const log = await tx.questLog.create({
      data: { userId: ctx.user.id, questId: quest.id, day, ...stamps },
    });
    await tx.pointsLedger.create({
      data: {
        userId: ctx.user.id,
        amount: quest.points,
        reason: quest.title,
        source: PointsSource.QUEST,
        questLogId: log.id,
        ...stamps,
      },
    });
    await bumpCaches(tx, stamps, quest.points);
  });
}

// Measurable quest ("36 / 50"). Handles the leftover-PENDING upgrade path.
export async function performMeasuredQuest(
  ctx: WriteCtx,
  quest: Quest,
  actual: number,
  day: string,
) {
  const stamps = personStamps(ctx);
  const award = async (tx: Prisma.TransactionClient, questLogId: number) => {
    await tx.pointsLedger.create({
      data: {
        userId: ctx.user.id,
        amount: quest.points,
        reason: quest.title,
        source: PointsSource.QUEST,
        questLogId,
        ...stamps,
      },
    });
    await bumpCaches(tx, stamps, quest.points);
  };

  try {
    await prisma.$transaction(async (tx) => {
      const log = await tx.questLog.create({
        data: {
          userId: ctx.user.id,
          questId: quest.id,
          day,
          status: "APPROVED",
          actual,
          ...stamps,
        },
      });
      await award(tx, log.id);
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // A log already exists today. If it's a leftover PENDING one (from the
      // brief predict-first flow), upgrade it and award once; done = no-op.
      const existing = await prisma.questLog.findUnique({
        where: {
          userId_questId_day: { userId: ctx.user.id, questId: quest.id, day },
        },
      });
      if (existing && existing.status === "PENDING") {
        await prisma.$transaction(async (tx) => {
          await tx.questLog.update({
            where: { id: existing.id },
            data: { actual, status: "APPROVED", ...stamps },
          });
          await award(tx, existing.id);
        });
      }
      return;
    }
    throw error;
  }
}

// Undo today's completion — reverses the EXACT ledger row by its own stamps.
export async function performUndoQuest(ctx: WriteCtx, questId: number, day: string) {
  await prisma.$transaction(async (tx) => {
    const log = await tx.questLog.findUnique({
      where: { userId_questId_day: { userId: ctx.user.id, questId, day } },
      include: { pointsLedger: true },
    });
    if (!log) return; // not completed today — nothing to undo

    const amount = log.pointsLedger?.amount ?? 0;
    // Reverse where the award actually landed, not where ctx points now.
    const stamps: Stamps = {
      profileId: log.pointsLedger?.profileId ?? null,
      membershipId: log.pointsLedger?.membershipId ?? null,
    };
    // Deleting the log cascades its linked PointsLedger row (questLogId).
    await tx.questLog.delete({ where: { id: log.id } });
    if (amount > 0) await bumpCaches(tx, stamps, -amount);
  });
}

// Coach adjustment (+/-) on a player's MEMBERSHIP on the given team (the
// adjusting staff's acting team — for a two-team athlete, only that team's
// membership is credited). Only exists on a roster: returns false, writing
// nothing, when the target has no active membership there.
export async function performAdjustPoints(
  target: { id: number; teamId: number },
  amount: number,
  reason: string,
): Promise<boolean> {
  const membership = await prisma.membership.findFirst({
    where: {
      profile: { userId: target.id },
      teamId: target.teamId,
      endedAt: null,
      season: { isCurrent: true },
    },
    select: { id: true, profileId: true },
  });
  if (!membership) return false;
  const stamps = { profileId: membership.profileId, membershipId: membership.id };

  // Ledger row + cache bump in ONE transaction (mirror of logQuest).
  await prisma.$transaction(async (tx) => {
    await tx.pointsLedger.create({
      data: {
        userId: target.id,
        amount,
        reason,
        source: PointsSource.COACH_ADJUSTMENT,
        ...stamps,
      },
    });
    await bumpCaches(tx, stamps, amount);
  });
  return true;
}
