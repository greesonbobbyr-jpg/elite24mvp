"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { isOnboarded } from "@/lib/onboarding";

export type OnboardingState = { error?: string };

function optionalString(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

function optionalInt(value: FormDataEntryValue | null): number | null {
  const s = String(value ?? "").trim();
  if (s === "") return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export async function completeOnboarding(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await getCurrentUser();
  // Only an un-onboarded player may complete onboarding.
  if (!user || user.role !== "PLAYER" || isOnboarded(user)) {
    redirect("/");
  }

  const dream = String(formData.get("dream") ?? "").trim();
  if (dream === "") {
    return { error: "Please write your dream — it's the most important part." };
  }

  const fields = {
    dream,
    position: optionalString(formData.get("position")),
    jerseyNumber: optionalInt(formData.get("jerseyNumber")),
    heightInches: optionalInt(formData.get("heightInches")),
    favoritePlayer: optionalString(formData.get("favoritePlayer")),
    favoriteTeam: optionalString(formData.get("favoriteTeam")),
    onboardedAt: new Date(),
  };

  // Upsert keeps this safe even if a profile somehow already exists.
  await prisma.playerProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...fields },
    update: fields,
  });

  redirect("/");
}
