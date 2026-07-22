"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Save/remove the CURRENT user's own Web Push subscription rows. The endpoint
// is the identity; keys come from the browser's PushSubscription.toJSON().

export async function savePushSubscription(sub: {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
}): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };

  const endpoint = String(sub?.endpoint ?? "");
  const p256dh = String(sub?.keys?.p256dh ?? "");
  const auth = String(sub?.keys?.auth ?? "");
  if (!endpoint.startsWith("https://") || !p256dh || !auth) return { ok: false };

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh, auth },
    // Re-subscribing on a shared device reassigns the endpoint to whoever is
    // logged in now.
    update: { userId: user.id, p256dh, auth },
  });
  return { ok: true };
}

export async function removePushSubscription(
  endpoint: string,
): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  // Only the owner's own rows are deletable.
  await prisma.pushSubscription.deleteMany({
    where: { endpoint: String(endpoint ?? ""), userId: user.id },
  });
  return { ok: true };
}
