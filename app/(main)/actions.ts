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
    await prisma.$transaction([
      prisma.questLog.create({
        data: { userId: user.id, questId: quest.id, day: todayKey() },
      }),
      prisma.pointsLedger.create({
        data: {
          userId: user.id,
          amount: quest.points,
          reason: quest.title,
          source: PointsSource.QUEST,
        },
      }),
      prisma.playerProfile.update({
        where: { userId: user.id },
        data: { points: { increment: quest.points } },
      }),
    ]);
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

  await prisma.notification.create({
    data: { teamId: user.teamId, authorId: user.id, title, body },
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
