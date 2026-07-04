"use client";

import { useEffect, useRef, useState } from "react";
import { toggleReaction } from "./actions";
import { REACTION_FACES } from "./reactions";
import { useReply } from "./ReplyProvider";

// Messenger-style reactions + interactions for one message. This WRAPS the bubble
// (children). Interactions:
//  - TAP/click the bubble → toggle its timestamp, shown centered ABOVE it.
//  - HOVER (desktop) / LONG-PRESS (touch) → the 6-face picker + Reply.
// Existing reactions show as ONE badge tucked on the bubble's bottom-RIGHT corner
// (always right, like Messenger): the distinct emojis + the TOTAL count when
// there's more than one. Picking a face submits the server action unchanged.
export function MessageReactions({
  messageId,
  counts,
  myType,
  authorName,
  snippet,
  time,
  children,
}: {
  messageId: number;
  counts: Record<string, number>;
  myType: string | null;
  authorName: string;
  snippet: string;
  time: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const { setReplyingTo } = useReply();
  const wrapRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const longFired = useRef(false);

  // Close the picker when tapping/clicking outside.
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

  // Desktop hover: open immediately, but close on a short delay so the cursor can
  // travel across the small gap up to the floating picker without it vanishing.
  const openHover = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const scheduleClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 260);
  };

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
  const total = existing.reduce((n, f) => n + (counts[f.type] ?? 0), 0);

  return (
    <div
      ref={wrapRef}
      className={`relative w-fit ${existing.length > 0 ? "mb-3" : ""}`}
      onMouseEnter={openHover}
      onMouseLeave={scheduleClose}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
    >
      {/* timestamp — revealed above the message on tap (Messenger-style) */}
      {showTime && (
        <div className="e24-reveal mb-1 px-1 text-center text-[10px] font-medium text-zinc-500">
          {time}
        </div>
      )}

      {/* the bubble — tapping toggles the timestamp (unless a long-press just
          opened the picker) */}
      <div
        onClick={() => {
          if (longFired.current) {
            longFired.current = false;
            return;
          }
          setShowTime((t) => !t);
        }}
      >
        {children}
      </div>

      {/* reaction badge — always the bottom-RIGHT corner */}
      {existing.length > 0 && (
        <div className="absolute -bottom-3 right-2 z-20 flex items-center gap-1 rounded-full bg-zinc-800/95 px-1.5 py-0.5 shadow-md ring-1 ring-black/40">
          <span className="flex items-center gap-0.5">
            {existing.map((f) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={f.type} src={f.svg} alt="" className="h-4 w-4" />
            ))}
          </span>
          {total > 1 && (
            <span className="px-0.5 text-xs font-semibold tabular-nums text-zinc-100">
              {total}
            </span>
          )}
        </div>
      )}

      {/* the 6-face picker + Reply (hover / long-press), anchored right */}
      {open && (
        <div className="e24-reveal absolute bottom-full right-0 z-30 mb-1.5 flex items-center gap-0.5 rounded-full border border-red-600/30 bg-zinc-950/95 p-1 shadow-xl shadow-black/50 backdrop-blur">
          {REACTION_FACES.map((f) => (
            <form
              action={toggleReaction}
              key={f.type}
              onSubmit={() => setOpen(false)}
            >
              <input type="hidden" name="messageId" value={messageId} />
              <input type="hidden" name="reactionType" value={f.type} />
              <button
                type="submit"
                aria-label={f.type}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition hover:scale-110 active:scale-95 ${
                  myType === f.type ? "bg-white/15" : "hover:bg-white/10"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.svg} alt="" className="h-6 w-6" />
              </button>
            </form>
          ))}

          <span className="mx-0.5 w-px self-stretch bg-white/10" />
          <button
            type="button"
            aria-label="Reply"
            onClick={() => {
              setReplyingTo({ id: messageId, authorName, snippet });
              setOpen(false);
            }}
            className="flex h-8 items-center gap-1 rounded-full px-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/10"
          >
            ↩ Reply
          </button>
        </div>
      )}
    </div>
  );
}
