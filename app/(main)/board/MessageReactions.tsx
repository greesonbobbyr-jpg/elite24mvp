"use client";

import { useEffect, useRef, useState } from "react";
import { toggleReaction } from "./actions";
import { REACTION_FACES } from "./reactions";

// Messenger-style reactions for one message. Resting = compact pills (emoji +
// count) for the reaction types that exist; the user's own pick is highlighted.
// Hover (desktop) / tap or long-press (touch) reveals a bar of all 6 faces to
// pick from — each face submits the server action (create / replace / remove is
// resolved server-side). Progressive enhancement: every face + pill is a real
// <form action={toggleReaction}>, so it works even before the reveal JS runs.
// Reveal animation uses .e24-reveal, which the globals reduced-motion guard
// neutralizes.
export function MessageReactions({
  messageId,
  counts,
  myType,
  align = "left",
}: {
  messageId: number;
  counts: Record<string, number>;
  myType: string | null;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<number | null>(null);
  const longFired = useRef(false);

  // Close when tapping/clicking outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const startPress = () => {
    longFired.current = false;
    pressTimer.current = window.setTimeout(() => {
      longFired.current = true;
      setOpen(true);
    }, 400);
  };
  const cancelPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const existing = REACTION_FACES.filter((f) => (counts[f.type] ?? 0) > 0);

  const Face = ({ type, emoji }: { type: string; emoji: string }) => (
    <form action={toggleReaction} onSubmit={() => setOpen(false)}>
      <input type="hidden" name="messageId" value={messageId} />
      <input type="hidden" name="reactionType" value={type} />
      <button
        type="submit"
        aria-label={type}
        className={`flex h-9 w-9 items-center justify-center rounded-full text-lg transition hover:scale-110 active:scale-95 ${
          myType === type ? "bg-red-600/30 ring-1 ring-red-500" : "hover:bg-white/10"
        }`}
      >
        {emoji}
      </button>
    </form>
  );

  return (
    <div
      ref={wrapRef}
      className={`relative flex flex-wrap items-center gap-1.5 ${
        align === "right" ? "justify-end" : ""
      }`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* resting pills — one per existing reaction type */}
      {existing.map((f) => (
        <form action={toggleReaction} key={f.type}>
          <input type="hidden" name="messageId" value={messageId} />
          <input type="hidden" name="reactionType" value={f.type} />
          <button
            type="submit"
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs tabular-nums transition active:scale-95 ${
              myType === f.type
                ? "border-red-500 bg-red-600/20 text-white"
                : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/25"
            }`}
          >
            <span className="text-sm leading-none">{f.emoji}</span>
            <span>{counts[f.type]}</span>
          </button>
        </form>
      ))}

      {/* add-reaction trigger (tap / long-press / hover) */}
      <button
        type="button"
        aria-label="Add reaction"
        onClick={() => {
          if (longFired.current) {
            longFired.current = false;
            return; // long-press already opened it — don't toggle shut
          }
          setOpen((o) => !o);
        }}
        onPointerDown={startPress}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs transition active:scale-95 ${
          open
            ? "border-red-500 text-red-400"
            : "border-white/10 text-zinc-500 hover:border-white/25 hover:text-zinc-300"
        }`}
      >
        <span aria-hidden>☺</span>
      </button>

      {/* the 6-face picker bar */}
      {open && (
        <div
          className={`e24-reveal absolute bottom-full z-20 mb-1.5 flex gap-0.5 rounded-full border border-red-600/30 bg-zinc-950/95 p-1 shadow-xl shadow-black/50 backdrop-blur ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {REACTION_FACES.map((f) => (
            <Face key={f.type} type={f.type} emoji={f.emoji} />
          ))}
        </div>
      )}
    </div>
  );
}
