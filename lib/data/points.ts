import { Prisma, PointsSource, type Quest } from "@prisma/client";
import { prisma } from "../prisma";
import { advanceStreak } from "../streaks";
import { createMyEntryInTx, createMyReviewOp } from "./reflections";

// THE points write paths (hierarchy rebuild Stage 3). Every transaction here
// dual-writes: the legacy statements are the VERBATIM bodies that lived in the
// server actions through Stage 2, and each transaction additionally
// - stamps new-dimension columns (profileId / membershipId) on the rows it
//   creates, and
// - updates Profile.careerPoints and Membership.points in the SAME transaction
//   as PlayerProfile.points — one commit, three caches, same ledger row.
//
// Offseason ruling (HIERARCHY_PLAN.md §2.10): membershipId is REQUIRED for
// quest completions and coach adjustments — those stamp only when the actor
// has BOTH a Profile and an acting Membership (all-or-nothing; a quest row
// must never carry a profile stamp without its membership). Check-ins and
// reviews stamp profileId whenever a Profile exists and NULL membershipId when
// there is no active membership (career points still accrue; no team board).
//
// Legacy-only logins (created by the old signup path, no Profile yet) stamp
// nothing — their rows converge at the idempotent backfill re-run (Stage 4a).
// Undo reverses BY THE LEDGER ROW'S OWN STAMPS, never the current ctx, so an
// award is always reversed exactly where it landed.

// The slice of ctx these writes need. lib/context's Ctx satisfies it.
export type WriteCtx = {
  user: { id: number };
  profile: { id: number } | null;
  membership: { id: number } | null;
};

// Bump careerPoints (+ membership points when stamped) inside a transaction.
async function bumpNewCaches(
  tx: Prisma.TransactionClient,
  stamps: { profileId: number | null; membershipId: number | null },
  amount: number,
) {
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

// Stamps for person-scope sources (check-in / review): profile whenever known,
// membership nullable (offseason ruling).
function personStamps(ctx: WriteCtx) {
  return {
    profileId: ctx.profile?.id ?? null,
    membershipId: ctx.profile ? (ctx.membership?.id ?? null) : null,
  };
}

// Stamps for team-context sources (quests / adjustments): all-or-nothing.
function teamStamps(ctx: WriteCtx) {
  return ctx.profile && ctx.membership
    ? { profileId: ctx.profile.id, membershipId: ctx.membership.id }
    : { profileId: null, membershipId: null };
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
    // [userId, day] on JournalEntry guarantees this runs once per day).
    const profile = await tx.playerProfile.findUnique({
      where: { userId: ctx.user.id },
      select: {
        currentStreak: true,
        bestStreak: true,
        lastCheckInDay: true,
        streakGraceUsed: true,
      },
    });
    const streak = advanceStreak(
      profile ?? {
        currentStreak: 0,
        bestStreak: 0,
        lastCheckInDay: null,
        streakGraceUsed: false,
      },
      day,
    );
    await tx.playerProfile.update({
      where: { userId: ctx.user.id },
      data: { points: { increment: pointsPerCheckIn }, ...streak },
    });
    // Dual-write: same streak fields mirror onto the Profile (they follow the
    // PERSON), careerPoints/membership.points alongside the legacy cache.
    if (stamps.profileId != null) {
      await tx.profile.update({
        where: { id: stamps.profileId },
        data: { ...streak },
      });
    }
    await bumpNewCaches(tx, stamps, pointsPerCheckIn);
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
  // Same ARRAY transaction as always (createMyReviewOp returns the unexecuted
  // create), with the new-cache ops appended to the same commit.
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
    prisma.playerProfile.update({
      where: { userId: ctx.user.id },
      data: { points: { increment: pointsPerReview } },
    }),
  ];
  if (stamps.profileId != null) {
    ops.push(
      prisma.profile.update({
        where: { id: stamps.profileId },
        data: { careerPoints: { increment: pointsPerReview } },
      }),
    );
  }
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
  const stamps = teamStamps(ctx);
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
    await tx.playerProfile.update({
      where: { userId: ctx.user.id },
      data: { points: { increment: quest.points } },
    });
    await bumpNewCaches(tx, stamps, quest.points);
  });
}

// Measurable quest ("36 / 50"). Handles the leftover-PENDING upgrade path.
export async function performMeasuredQuest(
  ctx: WriteCtx,
  quest: Quest,
  actual: number,
  day: string,
) {
  const stamps = teamStamps(ctx);
  const award = (tx: Prisma.TransactionClient, questLogId: number) =>
    Promise.all([
      tx.pointsLedger.create({
        data: {
          userId: ctx.user.id,
          amount: quest.points,
          reason: quest.title,
          source: PointsSource.QUEST,
          questLogId,
          ...stamps,
        },
      }),
      tx.playerProfile.update({
        where: { userId: ctx.user.id },
        data: { points: { increment: quest.points } },
      }),
      bumpNewCaches(tx, stamps, quest.points),
    ]);

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
    const stamps = {
      profileId: log.pointsLedger?.profileId ?? null,
      membershipId: log.pointsLedger?.membershipId ?? null,
    };
    // Deleting the log cascades its linked PointsLedger row (questLogId).
    await tx.questLog.delete({ where: { id: log.id } });
    if (amount > 0) {
      await tx.playerProfile.update({
        where: { userId: ctx.user.id },
        data: { points: { decrement: amount } },
      });
      await bumpNewCaches(tx, stamps, -amount);
    }
  });
}

// Coach adjustment (+/-) targeting a player. membershipId REQUIRED (team-
// context source): stamps only when the TARGET has a profile AND an active
// membership on their team; a legacy-only target gets the legacy write alone.
export async function performAdjustPoints(
  target: { id: number; teamId: number },
  amount: number,
  reason: string,
) {
  const profile = await prisma.profile.findUnique({
    where: { userId: target.id },
    select: { id: true },
  });
  const membership = profile
    ? await prisma.membership.findFirst({
        where: {
          profileId: profile.id,
          teamId: target.teamId,
          endedAt: null,
          season: { isCurrent: true },
        },
        select: { id: true },
      })
    : null;
  const stamps =
    profile && membership
      ? { profileId: profile.id, membershipId: membership.id }
      : { profileId: null, membershipId: null };

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
    await tx.playerProfile.update({
      where: { userId: target.id },
      data: { points: { increment: amount } },
    });
    await bumpNewCaches(tx, stamps, amount);
  });
}
