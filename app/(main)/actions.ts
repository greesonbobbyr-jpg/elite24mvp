"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { actingScope, actingTeamId, getCurrentContext, snapshotAuthorRole } from "@/lib/context";
import { can } from "@/lib/authz";
import { isSetUp } from "@/lib/onboarding";
import { isPlayerSide, personaOf } from "@/lib/persona";
import { listActiveQuestsForOrg } from "@/lib/quests";
import { todayKey } from "@/lib/journal";
import { hasMyEntryFor } from "@/lib/data/reflections";
import {
  performCheckIn,
  performMeasuredQuest,
  performOneTapQuest,
  performReview,
  performUndoQuest,
} from "@/lib/data/points";
import { POINTS_PER_CHECKIN, POINTS_PER_REVIEW } from "@/lib/points";

export type CheckInState = { error?: string };

// Records today's daily check-in for the current player. In ONE transaction it
// writes the JournalEntry, a matching PointsLedger row, and bumps the cached
// total. The @@unique([userId, day]) guarantees one check-in per day.
export async function submitCheckIn(
  _prevState: CheckInState,
  formData: FormData,
): Promise<CheckInState> {
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  if (!ctx || !user || !isPlayerSide(personaOf(ctx)) || !isSetUp(ctx)) {
    return { error: "Only a player can check in." };
  }

  const reflection = String(formData.get("reflection") ?? "").trim();
  if (reflection === "") {
    return { error: "Write a little about what you'll work on today." };
  }

  // The check-in stands on its own — writing today's reflection is all it takes.
  // The 1-Minute Mindset takeaway is a separate, optional reflection and does NOT
  // gate this (it used to, which broke submitting the check-in first).
  // The entry + ledger + all caches + streak commit in ONE transaction
  // (lib/data/points).
  try {
    await performCheckIn(ctx, reflection, todayKey(), POINTS_PER_CHECKIN);
  } catch (error) {
    // Unique violation = already checked in today. Treat as a no-op success.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      revalidatePath("/");
      return {};
    }
    throw error;
  }

  revalidatePath("/");
  return {};
}

export type TakeawayState = { error?: string; ok?: boolean };

// Saves (or edits) today's 1-Minute Mindset takeaway for the current player.
// An independent, optional reflection — it does NOT gate the daily check-in.
// One per player per day (upsert on @@unique). Non-empty required.
export async function saveMindsetTakeaway(
  _prevState: TakeawayState,
  formData: FormData,
): Promise<TakeawayState> {
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  if (!ctx || !user || !isPlayerSide(personaOf(ctx)) || !isSetUp(ctx)) {
    return { error: "Only a player can do this." };
  }
  const text = String(formData.get("text") ?? "").trim();
  if (text === "") {
    return { error: "Write a few words on what you took from it." };
  }

  // The person, and the at-time membership stamp (coach visibility is scoped
  // to the team the athlete was acting for THAT DAY).
  const stamps = { profileId: ctx.profile.id, membershipId: ctx.membership?.id ?? null };
  const day = todayKey();
  await prisma.mindsetTakeaway.upsert({
    where: { userId_day: { userId: user.id, day } },
    create: { userId: user.id, day, text, ...stamps },
    update: { text, ...stamps },
  });
  revalidatePath("/");
  return { ok: true };
}

export type ReviewState = { error?: string };

// The evening "Pro Review" — the closing step of the E24P cycle. Requires
// today's check-in (the review looks back at the morning plan), records how it
// went + what the player noticed + an optional note to tomorrow-you, and awards
// +POINTS_PER_REVIEW once (the @@unique([userId, day]) makes it idempotent).
// PRIVACY: review text is player-private; the coach only ever sees done/not.
export async function submitReview(
  _prevState: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  if (!ctx || !user || !isPlayerSide(personaOf(ctx)) || !isSetUp(ctx)) {
    return { error: "Only a player can review their day." };
  }

  const outcomeRaw = String(formData.get("outcome") ?? "");
  if (!["YES", "PARTIAL", "NO"].includes(outcomeRaw)) {
    return { error: "Pick how today's plan went." };
  }
  const outcome = outcomeRaw as "YES" | "PARTIAL" | "NO";
  const learned = String(formData.get("learned") ?? "").trim();
  if (learned === "") {
    return { error: "Write one thing you noticed today." };
  }
  const noteToTomorrow =
    String(formData.get("noteToTomorrow") ?? "").trim() || null;

  const day = todayKey();
  if (!(await hasMyEntryFor({ user }, day))) {
    return { error: "Check in first — the review looks back at today's plan." };
  }

  // Review + ledger + all caches in ONE transaction (lib/data/points).
  try {
    await performReview(ctx, { day, outcome, learned, noteToTomorrow }, POINTS_PER_REVIEW);
  } catch (error) {
    // Unique violation = already reviewed today (no double award). No-op success.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      revalidatePath("/");
      return {};
    }
    throw error;
  }

  revalidatePath("/");
  return {};
}

// A quest may be logged only if it's in the set this player is SERVED today:
// their org's quests, or the Elite24 set for an athlete with no team (and, for
// an org that has none active yet, the same fallback the quest page shows).
async function servedQuest(organizationId: number | null | undefined, questId: number) {
  const quests = await listActiveQuestsForOrg(organizationId);
  return quests.find((q) => q.id === questId) ?? null;
}

// MEASURABLE quests (Quest.targetCount != null): the player logs HOW MANY they
// made in one step ("36 / 50") — recorded on the QuestLog and shown on the tile.
// (A predict-first step existed briefly; the owner cut it — logging the real
// count keeps the self-tracking value without the guessing homework.)
export async function completeQuest(formData: FormData): Promise<void> {
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  if (!ctx || !user || !isPlayerSide(personaOf(ctx)) || !isSetUp(ctx)) return;

  const questId = Number.parseInt(String(formData.get("questId") ?? ""), 10);
  const actual = Number.parseInt(String(formData.get("actual") ?? ""), 10);
  if (!Number.isInteger(questId) || !Number.isInteger(actual)) return;

  const quest = await servedQuest(ctx.org?.id, questId);
  if (!quest || quest.targetCount == null) return;
  if (actual < 0 || actual > quest.targetCount) return;

  // Log + ledger + all caches in ONE transaction, incl. the leftover-PENDING
  // upgrade path (lib/data/points).
  await performMeasuredQuest(ctx, quest, actual, todayKey());

  revalidatePath("/quests");
  revalidatePath("/");
}

// Logs that the current player completed a quest today. Same transactional
// shape as submitCheckIn: create the QuestLog, write a PointsLedger row
// (source QUEST, amount = the quest's points), and bump the cached total. The
// @@unique([userId, questId, day]) guarantees one log per quest per day.
export async function logQuest(formData: FormData): Promise<void> {
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  if (!ctx || !user || !isPlayerSide(personaOf(ctx)) || !isSetUp(ctx)) return;

  const questId = Number.parseInt(String(formData.get("questId") ?? ""), 10);
  if (!Number.isInteger(questId)) return;

  const quest = await servedQuest(ctx.org?.id, questId);
  if (!quest) return;
  // Measurable quests go through the predict-then-log flow, never one-tap.
  if (quest.targetCount != null) return;

  // Log + ledger + all caches in ONE transaction (lib/data/points).
  try {
    await performOneTapQuest(ctx, quest, todayKey());
  } catch (error) {
    // Unique violation = already logged this quest today. No-op success.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      revalidatePath("/");
      return;
    }
    throw error;
  }

  revalidatePath("/quests");
  revalidatePath("/");
}

// Undo today's completion of a quest for the CURRENT player only — the mirror of
// logQuest. Removes today's QuestLog and (via the questLogId cascade) the exact
// PointsLedger row it created, and decrements the cached total by that amount —
// all in one transaction. Scoped to the current user + this quest + TODAY, so it
// can never touch another player's completion. Not-completed = harmless no-op.
export async function undoQuest(formData: FormData): Promise<void> {
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  if (!ctx || !user || !isPlayerSide(personaOf(ctx)) || !isSetUp(ctx)) return;

  const questId = Number.parseInt(String(formData.get("questId") ?? ""), 10);
  if (!Number.isInteger(questId)) return;

  // Reverses the exact ledger row (by its own stamps) + all caches in ONE
  // transaction (lib/data/points).
  await performUndoQuest(ctx, questId, todayKey());

  revalidatePath("/quests");
  revalidatePath("/");
}

export type NotificationState = { error?: string };

// A coach posts a notification to their OWN team only.
export async function postNotification(
  _prevState: NotificationState,
  formData: FormData,
): Promise<NotificationState> {
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  if (!ctx || !user) return { error: "Only a coach can post notifications." };
  // Matrix: HEAD_COACH / ASSISTANT_COACH / GENERAL_MANAGER / ORG_ADMIN may
  // post to the team they're acting on.
  const scope = actingScope(ctx);
  const mayPost = scope != null && can(ctx, "post_notification", scope);
  if (!mayPost) return { error: "Only a coach can post notifications." };
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (title === "" || body === "") {
    return { error: "Add a title and a message." };
  }
  // Urgent takeover flag — send_timeout is HC/ORG_ADMIN only per the matrix;
  // a staffer without it posts a NORMAL notification (silent downgrade, same
  // pattern as special board types).
  const maySendTimeout = scope != null && can(ctx, "send_timeout", scope);
  const isTimeout = formData.get("isTimeout") === "on" && maySendTimeout;

  // The acting team — the same one the permission check above used.
  const teamId = actingTeamId(ctx);
  if (teamId == null) return { error: "Pick a team first." };
  await prisma.notification.create({
    data: {
      teamId,
      authorId: user.id,
      title,
      body,
      isTimeout,
      // The person + the role snapshot ("Coach Gary · Head Coach").
      authorProfileId: ctx.profile.id,
      authorRole: snapshotAuthorRole(ctx),
    },
  });
  revalidatePath("/notifications");
  revalidatePath("/");
  return {};
}

// A player confirms they've read a notification. One per player per
// notification (DB unique). Team-private: a player can only confirm a
// notification posted to their ACTING team — the same team whose TIME OUT
// takeover they're being shown (a two-team athlete used to be checked against
// their original team and could never dismiss it).
export async function confirmRead(formData: FormData): Promise<void> {
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  if (!ctx || !user || !isPlayerSide(personaOf(ctx)) || !isSetUp(ctx)) return;
  // Read receipts belong to roster members only.
  if (!ctx.membership) return;

  const notificationId = Number.parseInt(
    String(formData.get("notificationId") ?? ""),
    10,
  );
  if (!Number.isInteger(notificationId)) return;

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { teamId: true },
  });
  const teamId = actingTeamId(ctx);
  if (!notification || teamId == null || notification.teamId !== teamId) return;

  try {
    await prisma.notificationRead.create({
      data: {
        notificationId,
        userId: user.id,
        profileId: ctx.profile.id,
      },
    });
  } catch (error) {
    // Unique violation = already confirmed. No-op success.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      revalidatePath("/notifications");
      revalidatePath("/");
      return;
    }
    throw error;
  }

  revalidatePath("/notifications");
  revalidatePath("/");
}
