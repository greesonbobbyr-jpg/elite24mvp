"use server";

import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/context";
import { changeOwnPassword } from "@/lib/account";
import { rateLimit, RATE_LIMITED_MESSAGE } from "@/lib/ratelimit";

export type PasswordState = { error?: string };

// Always the session's own account — there is no id field to tamper with.
export async function changePassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const userId = await getCurrentUserId();
  if (userId === null) redirect("/login");
  // Each attempt checks the current password: cap guessing.
  if (!(await rateLimit("password-change", String(userId), 10, 3600))) {
    return { error: RATE_LIMITED_MESSAGE };
  }
  const result = await changeOwnPassword(userId, {
    current: String(formData.get("current") ?? ""),
    next: String(formData.get("next") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if ("error" in result) return { error: result.error };
  redirect("/");
}
