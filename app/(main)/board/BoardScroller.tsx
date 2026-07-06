"use client";

import { useEffect, useRef } from "react";

// The board's single scrolling region (the message list). Owns scroll behavior
// only — no data/logic:
//  - jumps to the newest message on open,
//  - when a new message arrives (latestId changes), scrolls to the bottom ONLY
//    if the user was already near the bottom (so reading history isn't yanked),
//  - respects prefers-reduced-motion (instant instead of smooth).
export function BoardScroller({
  latestId,
  className,
  children,
}: {
  latestId: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);

  // Land on the newest message when the board opens.
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // New message → follow to the bottom, but only if the user hasn't scrolled up.
  useEffect(() => {
    const el = ref.current;
    if (!el || !nearBottom.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [latestId]);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  return (
    <div ref={ref} onScroll={onScroll} className={className}>
      {children}
    </div>
  );
}
