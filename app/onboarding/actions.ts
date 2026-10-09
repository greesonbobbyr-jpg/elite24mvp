"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/lib/context";
import { isSetUp } from "@/lib/onboarding";
import { parseHeight } from "@/lib/height";

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
  const ctx = await getCurrentContext();
  const user = ctx?.user;
  // Only an athlete who hasn't completed setup may run this (4f gate; staff
  // are always set up).
  if (!ctx || !user || isSetUp(ctx)) {
    redirect("/");
  }

  const dream = String(formData.get("dream") ?? "").trim();
  if (dream === "") {
    return { error: "Please write your dream — it's the most important part." };
  }
  const height = parseHeight(formData.get("heightFt"), formData.get("heightIn"));
  if (!height.ok) return { error: height.error };

  const fields = {
    dream,
    position: optionalString(formData.get("position")),
    jerseyNumber: optionalInt(formData.get("jerseyNumber")),
    heightInches: height.inches,
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

  // Dual-write: mirror onto the permanent Profile (onboardedAt maps to the
  // new setup gate). Legacy-only logins have no Profile — converge at 4a.
  if (ctx.profile) {
    const { onboardedAt, ...identity } = fields;
    await prisma.profile.update({
      where: { id: ctx.profile.id },
      data: { ...identity, setupCompletedAt: onboardedAt },
    });
  }

  redirect("/");
}
