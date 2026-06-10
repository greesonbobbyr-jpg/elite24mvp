"use server";

import { revalidatePath } from "next/cache";
import { setCurrentUserId, clearCurrentUser } from "@/lib/session";

// Server actions backing the dev-only user switcher. Both are hard-guarded so
// they can never take effect in production (CLAUDE.md section 7).
function assertDev() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The dev user switcher is disabled in production.");
  }
}

export async function switchUser(formData: FormData): Promise<void> {
  assertDev();
  const id = Number.parseInt(String(formData.get("userId")), 10);
  if (Number.isInteger(id)) {
    await setCurrentUserId(id);
  }
  revalidatePath("/", "layout");
}

export async function clearUser(): Promise<void> {
  assertDev();
  await clearCurrentUser();
  revalidatePath("/", "layout");
}
