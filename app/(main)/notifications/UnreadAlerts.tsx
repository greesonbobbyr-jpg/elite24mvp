"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { confirmRead } from "../actions";
import { flurry } from "../celebrate";
import { WhistleIcon } from "@/app/components/WhistleIcon";
import { Button } from "@/app/components/ui/Button";
import { chipClass } from "@/app/components/ui/Pill";

// The player's unread alerts, with a reaction you can't miss when you mark
// one read (owner, 2026-10-09: "you just click it and … it looks like nothing
// happens and you have to scroll down"): the card turns green with a check
// and a small burst, then folds away so the next one slides up; a message at
// the bottom confirms it and says how many are left; the "To read" count
// drops. The read is saved with the existing confirmRead action, and the page
// refreshes into "Earlier" behind the scenes.

export type UnreadAlert = {
  id: number;
  initials: string;
  authorName: string;
  authorRoleLabel: string | null;
  when: string;
  title: string;
  body: string;
  isTimeout: boolean;
};

// How long the green "Read" state shows before the card folds away.
const SHOW_READ_MS = 650;

export function UnreadAlerts({ items }: { items: UnreadAlert[] }) {
  // Tapped alerts: "read" (green, still open), then "gone" (folded away).
  const [phase, setPhase] = useState<Record<number, "read" | "gone">>({});
  // Tapped alerts stay on screen (where they were) until they've folded away,
  // even after the refresh has moved them to "Earlier".
  const [tapped, setTapped] = useState<Record<number, { alert: UnreadAlert; index: number }>>({});
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
  const [, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const shown = [...items];
  for (const { alert, index } of Object.values(tapped).sort((a, b) => a.index - b.index)) {
    if (!shown.some((n) => n.id === alert.id)) shown.splice(Math.min(index, shown.length), 0, alert);
  }
  const left = items.filter((n) => !phase[n.id]).length;

  function markRead(n: UnreadAlert, button: HTMLElement) {
    if (phase[n.id]) return;
    flurry(button);
    setPhase((p) => ({ ...p, [n.id]: "read" }));
    setTapped((t) => ({ ...t, [n.id]: { alert: n, index: shown.findIndex((m) => m.id === n.id) } }));
    const stillToRead = left - 1;
    setToast((t) => ({
      text: stillToRead > 0 ? `✓ Marked as read · ${stillToRead} still to read` : "✓ All caught up",
      n: (t?.n ?? 0) + 1,
    }));
    setTimeout(() => {
      setPhase((p) => ({ ...p, [n.id]: "gone" }));
      headingRef.current?.focus({ preventScroll: true });
    }, SHOW_READ_MS);
    const form = new FormData();
    form.set("notificationId", String(n.id));
    startTransition(() => confirmRead(form));
  }

  return (
    <>
      {shown.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 ref={headingRef} tabIndex={-1} className="e24-eyebrow outline-none">
            {left > 0 ? `To read · ${left}` : "All caught up"}
          </h2>
          <ol className="flex flex-col">
            {shown.map((n) => {
              const state = phase[n.id];
              return (
                <li
                  key={n.id}
                  className={`grid transition-all duration-300 ease-out ${
                    state === "gone" ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] pb-4"
                  }`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div
                      className={`e24-surface overflow-hidden rounded-2xl transition ${
                        state ? "border-2 border-good-solid" : n.isTimeout ? "border-2 border-accent-edge" : ""
                      }`}
                    >
                      <div className="flex">
                        <div className={`w-1.5 shrink-0 transition-colors ${state ? "bg-good-solid" : "bg-accent"}`} />
                        <div className="relative z-10 flex-1 p-5">
                          {/* author identity row — name + role snapshot (4c) */}
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">
                              {n.initials}
                            </span>
                            <div className="min-w-0 flex-1 leading-tight">
                              <p className="truncate text-sm font-semibold text-ink">
                                {n.authorName}
                                {n.authorRoleLabel && (
                                  <span className="font-normal text-muted"> · {n.authorRoleLabel}</span>
                                )}
                              </p>
                              <p className="text-[11px] text-subtle">{n.when}</p>
                            </div>
                            {!state && (
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]"
                                aria-label="Unread"
                              />
                            )}
                          </div>

                          <h3 className="mt-3 font-bold text-ink">
                            {n.isTimeout && <TimeoutBadge />}
                            {n.title}
                          </h3>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{n.body}</p>

                          <div className="mt-4">
                            {state ? (
                              <span className={`${chipClass("good")} e24-reveal px-3 py-1.5 text-sm`}>✓ Read</span>
                            ) : (
                              <Button type="button" size="sm" onClick={(e) => markRead(n, e.currentTarget)}>
                                I&apos;ve read this
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {toast && (
        <p
          key={toast.n}
          role="status"
          className="e24-reveal fixed inset-x-0 bottom-24 z-30 mx-auto w-max max-w-[90vw] rounded-full bg-good-solid px-5 py-2.5 text-sm font-semibold text-on-accent shadow-lg shadow-shade"
        >
          {toast.text}
        </p>
      )}
    </>
  );
}

// Small solid accent badge marking a notification as an urgent TIME OUT.
export function TimeoutBadge() {
  return (
    <span className="mr-2 inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-on-accent">
      <WhistleIcon className="h-3 w-3" />
      Time Out
    </span>
  );
}
