"use server";

import { cookies } from "next/headers";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ACTING_COOKIE } from "@/lib/context";

// DEV-ONLY: mint a REAL Auth.js session for a seeded user (via the "impersonate"
// provider, which only exists in dev) or sign out. Guarded so it's a no-op in
// production — the switcher UI is dev-only too (see layout DevSwitcherSlot).
// An optional membershipId selects the ACTING membership: the e24_ctx cookie
// is set (the resolver re-validates it every request, so a mismatched id just
// falls back).
export async function impersonate(formData: FormData) {
  if (process.env.NODE_ENV === "production") return;
  const userId = String(formData.get("userId") ?? "");
  if (!/^\d+$/.test(userId)) return;

  const membershipIdRaw = String(formData.get("membershipId") ?? "");
  const jar = await cookies();
  if (/^\d+$/.test(membershipIdRaw)) {
    const membership = await prisma.membership.findFirst({
      where: {
        id: Number(membershipIdRaw),
        endedAt: null,
        profile: { userId: Number(userId) },
      },
      select: { id: true },
    });
    if (membership) {
      jar.set(ACTING_COOKIE, String(membership.id), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }
  } else {
    jar.delete(ACTING_COOKIE);
  }
  await signIn("impersonate", { userId, redirectTo: "/" });
}

export async function stopImpersonating() {
  if (process.env.NODE_ENV === "production") return;
  await signOut({ redirectTo: "/login" });
}
