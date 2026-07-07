"use client";

import { useEffect, useState } from "react";

// A dismissible "add to home screen" prompt. Two paths, since browsers differ:
//  - Android/desktop Chrome: capture the `beforeinstallprompt` event and offer a
//    one-tap "Add" button that fires the native install dialog.
//  - iOS Safari: no such event — show the manual "Share → Add to Home Screen"
//    instructions instead.
// Hidden once installed (standalone display-mode) or dismissed (localStorage).

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "e24-install-dismissed";

export function InstallBanner() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    // Already installed? Don't nag.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari exposes this non-standard flag when launched from the home screen.
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const ua = navigator.userAgent;
    // iOS Safari (exclude Chrome/Firefox on iOS, which can't add to home screen).
    const ios = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua);
    setIsIOS(ios);

    const onPrompt = (e: Event) => {
      e.preventDefault(); // stop Chrome's mini-infobar; we show our own
      setDeferred(e as InstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS never fires the event — show the instructional banner shortly after load.
    let t: ReturnType<typeof setTimeout> | undefined;
    if (ios) t = setTimeout(() => setShow(true), 1500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (t) clearTimeout(t);
    };
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore storage errors
    }
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => undefined);
    dismiss();
  };

  return (
    <div className="fixed bottom-20 left-1/2 z-[45] w-[min(92vw,420px)] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-red-600/40 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt=""
          className="h-10 w-10 shrink-0 rounded-lg"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            Add Elite24 to your home screen
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {isIOS
              ? "Tap the Share icon, then “Add to Home Screen”."
              : "Install the app for full-screen, one-tap access."}
          </p>
        </div>
        {!isIOS && deferred && (
          <button
            type="button"
            onClick={install}
            className="shrink-0 rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-red-500 active:scale-95"
          >
            Add
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-full px-2 py-1 text-lg leading-none text-zinc-500 transition hover:text-zinc-300"
        >
          ×
        </button>
      </div>
    </div>
  );
}
