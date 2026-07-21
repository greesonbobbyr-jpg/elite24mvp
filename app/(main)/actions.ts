"use server";

import { revalidatePath } from "next/cache";
import { Prisma, PointsSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isOnboarded } from "@/lib/onboarding";
import { todayKey } from "@/lib/journal";
import { POINTS_PER_CHECKIN, POINTS_PER_REVIEW } from "@/lib/points";
import { advanceStreak } from "@/lib/streaks";

export type CheckInState = { error?: string };

// Records today's daily check-in for the current player. In ONE transaction it
// writes the JournalEntry, a matching PointsLedger row, and bumps the cached
// total. The @@unique([userId, day]) guarantees one check-in per day.
export async function submitCheckIn(
  _prevState: CheckInState,
  formData: FormData,
): Promise<CheckInState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "PLAYER" || !isOnboarded(user)) {
    return { error: "Only a player can check in." };
  }

  const reflection = String(formData.get("reflection") ?? "").trim();
  if (reflection === "") {
    return { error: "Write a little about what you'll work on today." };
  }

  // The check-in stands on its own — writing today's reflection is all it takes.
  // The 1-Minute Mindset takeaway is a separate, optional reflection and does NOT
  // gate this (it used to, which broke submitting the check-in first).
  try {
    const day = todayKey();
    await prisma.$transaction(async (tx) => {
      await tx.journalEntry.create({
        data: { userId: user.id, reflection, day },
      });
      await tx.pointsLedger.create({
        data: {
          userId: user.id,
          amount: POINTS_PER_CHECKIN,
          reason: "Daily check-in",
          source: PointsSource.DAILY_CHECK_IN,
        },
      });
      // Advance the streak in the same transaction as the entry (the unique
      // [userId, day] on JournalEntry guarantees this runs once per day).
      const profile = await tx.playerProfile.findUnique({
        where: { userId: user.id },
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
        where: { userId: user.id },
        data: { points: { increment: POINTS_PER_CHECKIN }, ...streak },
      });
    });
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
  const user = await getCurrentUser();
  if (!user || user.role !== "PLAYER" || !isOnboarded(user)) {
    return { error: "Only a player can do this." };
  }
  const text = String(formData.get("text") ?? "").trim();
  if (text === "") {
    return { error: "Write a few words on what you took from it." };
  }

  const day = todayKey();
  await prisma.mindsetTakeaway.upsert({
    where: { userId_day: { userId: user.id, day } },
    create: { userId: user.id, day, text },
    update: { text },
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
  const user = await getCurrentUser();
  if (!user || user.role !== "PLAYER" || !isOnboarded(user)) {
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
  const entry = await prisma.journalEntry.findUnique({
    where: { userId_day: { userId: user.id, day } },
    select: { id: true },
  });
  if (!entry) {
    return { error: "Check in first — the review looks back at today's plan." };
  }

  try {
    await prisma.$transaction([
      prisma.dailyReview.create({
        data: { userId: user.id, day, outcome, learned, noteToTomorrow },
      }),
      prisma.pointsLedger.create({
        data: {
          userId: user.id,
          amount: POINTS_PER_REVIEW,
          reason: "Pro Review",
          source: PointsSource.REVIEW,
        },
      }),
      prisma.playerProfile.update({
        where: { userId: user.id },
        data: { points: { increment: POINTS_PER_REVIEW } },
      }),
    ]);
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

// PREDICT-THEN-LOG (measurable quests, Quest.targetCount != null). Step 1: the
// player predicts their count BEFORE doing the work — a PENDING QuestLog with
// `predicted`, no points yet. The predicted-vs-actual gap is the calibration
// feedback that trains self-assessment (the core of basketball IQ off the court).
export async function startQuest(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "PLAYER" || !isOnboarded(user)) return;

  const questId = Number.parseInt(String(formData.get("questId") ?? ""), 10);
  const predicted = Number.parseInt(String(formData.get("predicted") ?? ""), 10);
  if (!Number.isInteger(questId) || !Number.isInteger(predicted)) return;

  const quest = await prisma.quest.findUnique({ where: { id: questId } });
  if (!quest || !quest.active || quest.targetCount == null) return;
  if (predicted < 0 || predicted > quest.targetCount) return;

  try {
    await prisma.questLog.create({
      data: {
        userId: user.id,
        questId: quest.id,
        day: todayKey(),
        status: "PENDING",
        predicted,
      },
    });
  } catch (error) {
    // Already started/completed today — no-op.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      revalidatePath("/quests");
      return;
    }
    throw error;
  }

  revalidatePath("/quests");
  revalidatePath("/");
}

// Step 2: log the ACTUAL count → the PENDING log flips to APPROVED and the
// points are awarded (ledger row linked via questLogId so undo reverses it).
export async function completeQuest(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "PLAYER" || !isOnboarded(user)) return;

  const questId = Number.parseInt(String(formData.get("questId") ?? ""), 10);
  const actual = Number.parseInt(String(formData.get("actual") ?? ""), 10);
  if (!Number.isInteger(questId) || !Number.isInteger(actual)) return;

  const quest = await prisma.quest.findUnique({ where: { id: questId } });
  if (!quest || quest.targetCount == null) return;
  if (actual < 0 || actual > quest.targetCount) return;

  const day = todayKey();
  const log = await prisma.questLog.findUnique({
    where: { userId_questId_day: { userId: user.id, questId, day } },
  });
  if (!log || log.status !== "PENDING") return; // not started, or already done

  await prisma.$transaction(async (tx) => {
    await tx.questLog.update({
      where: { id: log.id },
      data: { actual, status: "APPROVED" },
    });
    await tx.pointsLedger.create({
      data: {
        userId: user.id,
        amount: quest.points,
        reason: quest.title,
        source: PointsSource.QUEST,
        questLogId: log.id,
      },
    });
    await tx.playerProfile.update({
      where: { userId: user.id },
      data: { points: { increment: quest.points } },
    });
  });

  revalidatePath("/quests");
  revalidatePath("/");
}

// Logs that the current player completed a quest today. Same transactional
// shape as submitCheckIn: create the QuestLog, write a PointsLedger row
// (source QUEST, amount = the quest's points), and bump the cached total. The
// @@unique([userId, questId, day]) guarantees one log per quest per day.
export async function logQuest(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "PLAYER" || !isOnboarded(user)) return;

  const questId = Number.parseInt(String(formData.get("questId") ?? ""), 10);
  if (!Number.isInteger(questId)) return;

  const quest = await prisma.quest.findUnique({ where: { id: questId } });
  if (!quest || !quest.active) return;
  // Measurable quests go through the predict-then-log flow, never one-tap.
  if (quest.targetCount != null) return;

  try {
    // Interactive transaction so the ledger row can link back to the created
    // QuestLog (questLogId) — undoQuest uses that link to reverse the exact row.
    await prisma.$transaction(async (tx) => {
      const log = await tx.questLog.create({
        data: { userId: user.id, questId: quest.id, day: todayKey() },
      });
      await tx.pointsLedger.create({
        data: {
          userId: user.id,
          amount: quest.points,
          reason: quest.title,
          source: PointsSource.QUEST,
          questLogId: log.id,
        },
      });
      await tx.playerProfile.update({
        where: { userId: user.id },
        data: { points: { increment: quest.points } },
      });
    });
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
  const user = await getCurrentUser();
  if (!user || user.role !== "PLAYER" || !isOnboarded(user)) return;

  const questId = Number.parseInt(String(formData.get("questId") ?? ""), 10);
  if (!Number.isInteger(questId)) return;

  const day = todayKey();
  await prisma.$transaction(async (tx) => {
    const log = await tx.questLog.findUnique({
      where: { userId_questId_day: { userId: user.id, questId, day } },
      include: { pointsLedger: true },
    });
    if (!log) return; // not completed today — nothing to undo

    const amount = log.pointsLedger?.amount ?? 0;
    // Deleting the log cascades its linked PointsLedger row (questLogId).
    await tx.questLog.delete({ where: { id: log.id } });
    if (amount > 0) {
      await tx.playerProfile.update({
        where: { userId: user.id },
        data: { points: { decrement: amount } },
      });
    }
  });

  revalidatePath("/quests");
  revalidatePath("/");
}

export type NotificationState = { error?: string };

// A coach posts a notification to their OWN team only.
export async function postNotification(
  _prevState: NotificationState,
  formData: FormData,
): Promise<NotificationState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "COACH") {
    return { error: "Only a coach can post notifications." };
  }
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (title === "" || body === "") {
    return { error: "Add a title and a message." };
  }
  // Urgent takeover flag — coach-only is already enforced above.
  const isTimeout = formData.get("isTimeout") === "on";

  await prisma.notification.create({
    data: { teamId: user.teamId, authorId: user.id, title, body, isTimeout },
  });
  revalidatePath("/notifications");
  revalidatePath("/");
  return {};
}

// A player confirms they've read a notification. One per player per
// notification (DB unique). Team-private: a player can only confirm a
// notification posted to their own team.
export async function confirmRead(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "PLAYER" || !isOnboarded(user)) return;

  const notificationId = Number.parseInt(
    String(formData.get("notificationId") ?? ""),
    10,
  );
  if (!Number.isInteger(notificationId)) return;

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { teamId: true },
  });
  if (!notification || notification.teamId !== user.teamId) return;

  try {
    await prisma.notificationRead.create({
      data: { notificationId, userId: user.id },
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
