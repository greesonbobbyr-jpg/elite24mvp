import webpush from "web-push";
import { prisma } from "./prisma";

// Web Push sender (VAPID). Configured lazily from env so builds without keys
// still succeed; senders no-op cleanly when unconfigured.

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    pub,
    priv,
  );
  configured = true;
  return true;
}

export type PushPayload = { title: string; body: string; url?: string };

// Send to every subscription a user has; prune endpoints the push service says
// are gone (404/410). Returns how many sends succeeded.
export async function pushToUser(
  userId: number,
  payload: PushPayload,
): Promise<number> {
  if (!ensureConfigured()) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await prisma.pushSubscription
          .delete({ where: { id: sub.id } })
          .catch(() => undefined);
      }
      // Other errors: skip this device, keep going.
    }
  }
  return sent;
}
