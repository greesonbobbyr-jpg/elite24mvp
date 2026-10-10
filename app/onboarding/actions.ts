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
  // Only an athlete who hasn't completed setup may run this (staff are
  // always set up).
  if (!ctx || !user || isSetUp(ctx)) {
    redirect("/");
  }

  const dream = String(formData.get("dream") ?? "").trim();
  if (dream === "") {
    return { error: "Please write your dream — it's the most important part." };
  }
  const height = parseHeight(formData.get("heightFt"), formData.get("heightIn"));
  if (!height.ok) return { error: height.error };

  // Writing the Dream completes setup.
  await prisma.profile.update({
    where: { id: ctx.profile.id },
    data: {
      dream,
      position: optionalString(formData.get("position")),
      jerseyNumber: optionalInt(formData.get("jerseyNumber")),
      heightInches: height.inches,
      favoritePlayer: optionalString(formData.get("favoritePlayer")),
      favoriteTeam: optionalString(formData.get("favoriteTeam")),
      setupCompletedAt: new Date(),
    },
  });

  redirect("/");
}
