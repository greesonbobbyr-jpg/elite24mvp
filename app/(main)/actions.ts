"use server";

import { revalidatePath } from "next/cache";
import { Prisma, PointsSource } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isOnboarded } from "@/lib/onboarding";
import { todayKey } from "@/lib/journal";
import { POINTS_PER_CHECKIN } from "@/lib/points";

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
    await prisma.$transaction([
      prisma.journalEntry.create({
        data: { userId: user.id, reflection, day: todayKey() },
      }),
      prisma.pointsLedger.create({
        data: {
          userId: user.id,
          amount: POINTS_PER_CHECKIN,
          reason: "Daily check-in",
          source: PointsSource.DAILY_CHECK_IN,
        },
      }),
      prisma.playerProfile.update({
        where: { userId: user.id },
        data: { points: { increment: POINTS_PER_CHECKIN } },
      }),
    ]);
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
