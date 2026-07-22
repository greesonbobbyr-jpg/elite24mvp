"use client";

import { useEffect, useState } from "react";
import { savePushSubscription, removePushSubscription } from "./push-actions";

// "Get a daily reminder" toggle (players). Registers /sw.js and subscribes to
// Web Push — the permission prompt fires only on tap (never on load), and the
// copy is kid-appropriate. The coach picks the reminder hour in Team Settings;
// no reminders are sent unless the coach turns them on.

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  // Explicit ArrayBuffer backing so it satisfies BufferSource under TS 5.7.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ok =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setEnabled(Boolean(sub));
    });
  }, []);

  if (!supported) return null;

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Notifications are blocked for this site.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
        ),
      });
      const res = await savePushSubscription(
        sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } },
      );
      if (!res.ok) throw new Error("save failed");
      setEnabled(true);
    } catch {
      setError("Couldn't turn on reminders. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setEnabled(false);
    } catch {
      setError("Couldn't turn reminders off. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Daily reminder</p>
          <p className="text-xs text-zinc-500">
            One nudge on days you haven&apos;t checked in — at the time your
            coach sets. No spam.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={enabled ? disable : enable}
          className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition active:scale-95 disabled:opacity-60 ${
            enabled
              ? "border border-white/20 text-zinc-300 hover:border-white/40"
              : "bg-red-600 text-white hover:bg-red-500"
          }`}
        >
          {busy ? "…" : enabled ? "Turn off" : "Turn on"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}
