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
