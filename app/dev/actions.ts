"use server";

import { signIn, signOut } from "@/auth";

// DEV-ONLY: mint a REAL Auth.js session for a seeded user (via the "impersonate"
// provider, which only exists in dev) or sign out. Guarded so it's a no-op in
// production — the switcher UI is dev-only too (see layout DevSwitcherSlot).
export async function impersonate(formData: FormData) {
  if (process.env.NODE_ENV === "production") return;
  const userId = String(formData.get("userId") ?? "");
  if (!/^\d+$/.test(userId)) return;
  await signIn("impersonate", { userId, redirectTo: "/" });
}

export async function stopImpersonating() {
  if (process.env.NODE_ENV === "production") return;
  await signOut({ redirectTo: "/login" });
}
