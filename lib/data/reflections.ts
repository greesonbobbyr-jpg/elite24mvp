import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { todayKey } from "../daykey";

// THE ONLY MODULE ALLOWED TO TOUCH JournalEntry AND DailyReview.
// Enforced by scripts/check-reflections-boundary.mjs, which fails the build if
// `prisma.journalEntry` / `prisma.dailyReview` (or the `tx.` forms) appear
// anywhere else in app/ or lib/.
//
// WHY: journals and reviews are author-only — no role, not coach, not
// ORG_ADMIN, has any query path to another person's reflections ("NOBODY.
// EVER." — HIERARCHY_PLAN.md §2.10). That guarantee is STRUCTURAL, not a
// permission: there is no journal action in lib/authz.ts to grant, and no
// CONTENT function below accepts a profile/user parameter — the author is
// always derived from the caller's own ctx, so the signatures cannot express
// "someone else's journal".
//
// The STATUS section at the bottom exists for coach surfaces, which may see
// that a reflection happened and when — never what was written. Every select
// there is content-free; keep it that way.
//
// Every row carries the login that wrote it (userId — reads key on it) and
// the person (profileId).

// The slice of ctx we need — the caller's own identity, nothing else. Reads
// need only the login; writes also stamp the person.
type OwnCtx = { user: { id: number } };
type OwnWriteCtx = OwnCtx & { profile: { id: number } };

// ---------------------------------------------------------------- content ---
// Author-only. No function here takes a profile/user parameter.

// Today's check-in for the current player, or null if not checked in yet.
export function getMyTodaysEntry(ctx: OwnCtx) {
  return prisma.journalEntry.findUnique({
    where: { userId_day: { userId: ctx.user.id, day: todayKey() } },
  });
}

// All of the current player's entries, newest first (the journal timeline).
export function listMyEntries(ctx: OwnCtx) {
  return prisma.journalEntry.findMany({
    where: { userId: ctx.user.id },
    orderBy: { createdAt: "desc" },
  });
}

// Whether the current player checked in on `day` — gates the evening Pro
// Review (the review looks back at the morning plan). Takes the day so the
// caller can use ONE day key for both the gate and the review row.
export async function hasMyEntryFor(ctx: OwnCtx, day: string): Promise<boolean> {
  const entry = await prisma.journalEntry.findUnique({
    where: { userId_day: { userId: ctx.user.id, day } },
    select: { id: true },
  });
  return Boolean(entry);
}

// Creates today's check-in entry INSIDE the caller's transaction (the check-in
// also writes the ledger row + streak in the same transaction; that
// orchestration stays with the action).
export function createMyEntryInTx(
  tx: Prisma.TransactionClient,
  ctx: OwnWriteCtx,
  reflection: string,
  day: string,
) {
  return tx.journalEntry.create({
    data: { userId: ctx.user.id, profileId: ctx.profile.id, reflection, day },
  });
}

// Today's Pro Review for the current player, or null.
export function getMyTodaysReview(ctx: OwnCtx) {
  return prisma.dailyReview.findUnique({
    where: { userId_day: { userId: ctx.user.id, day: todayKey() } },
  });
}

// The most recent past review carrying a "note to tomorrow-you" — surfaced
// above the next morning's check-in prompt (the investment loads the trigger).
export function getMyLatestReviewNote(ctx: OwnCtx) {
  return prisma.dailyReview.findFirst({
    where: {
      userId: ctx.user.id,
      day: { lt: todayKey() },
      noteToTomorrow: { not: null },
      NOT: { noteToTomorrow: "" },
    },
    orderBy: { day: "desc" },
    select: { day: true, noteToTomorrow: true },
  });
}

// The unexecuted create for today's review — returned as a PrismaPromise so
// the action can run it inside its array transaction with the points award.
export function createMyReviewOp(
  ctx: OwnWriteCtx,
  data: {
    day: string;
    outcome: "YES" | "PARTIAL" | "NO";
    learned: string;
    noteToTomorrow: string | null;
  },
) {
  return prisma.dailyReview.create({
    data: { userId: ctx.user.id, profileId: ctx.profile.id, ...data },
  });
}

// ----------------------------------------------------------------- status ---
// Coach-facing STATUS ONLY (CLAUDE.md §3): did a reflection happen, and when.
// These take target ids because cross-player status is their whole job — but
// every select below is content-free (never `reflection`, `learned`,
// `noteToTomorrow`, or `outcome`).

// Check-in times for a set of players on one day (roster status column —
// keyed by the ACTIVE roster's user ids, so a removed player's
// activity never counts against a team they're no longer on).
export function checkInTimesForUsers(userIds: number[], day: string) {
  return prisma.journalEntry.findMany({
    where: { day, userId: { in: userIds } },
    select: { userId: true, createdAt: true },
  });
}

// One player's check-in time for one day, or null.
export async function checkInTimeForPlayer(
  playerId: number,
  day: string,
): Promise<Date | null> {
  const entry = await prisma.journalEntry.findUnique({
    where: { userId_day: { userId: playerId, day } },
    select: { createdAt: true },
  });
  return entry?.createdAt ?? null;
}

// Whether a player completed their Pro Review on one day (done/not — no text).
export async function reviewDoneForPlayer(
  playerId: number,
  day: string,
): Promise<boolean> {
  const review = await prisma.dailyReview.findUnique({
    where: { userId_day: { userId: playerId, day } },
    select: { id: true },
  });
  return Boolean(review);
}

// How many days a player checked in since `sinceDay` (weekly consistency stat).
export function checkInCountForPlayer(playerId: number, sinceDay: string) {
  return prisma.journalEntry.count({
    where: { userId: playerId, day: { gte: sinceDay } },
  });
}

// How many check-ins happened on one day, app-wide (CEO View overview — a
// number only).
export function checkInCountOnDay(day: string) {
  return prisma.journalEntry.count({ where: { day } });
}

// How many Pro Reviews a player finished since `sinceDay` (done/not — a
// number only, no text).
export function reviewCountForPlayer(playerId: number, sinceDay: string) {
  return prisma.dailyReview.count({
    where: { userId: playerId, day: { gte: sinceDay } },
  });
}
