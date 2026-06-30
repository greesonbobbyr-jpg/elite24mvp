"use client";

import { useEffect, useRef, useState } from "react";
import { flurry, prefersReducedMotion } from "./celebrate";

// The points-total number. Renders statically on first load, then makes the
// total FUN when it ticks UP (a completion): a quick count-up + gold pulse + a
// small particle flurry. Quiet on first mount and on a DECREASE (undo). State
// persists across the server-action re-render, so the new value animates in.
export function AnimatedTotal({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  const [pulsing, setPulsing] = useState(false);
  const prev = useRef(value);
  const elRef = useRef<HTMLParagraphElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = prev.current;
    prev.current = value;
    if (value === from) return;

    // Decrease (undo) or reduced-motion: jump to the new value, no fanfare.
    if (value < from || prefersReducedMotion()) {
      setDisplay(value);
      return;
    }

    // Increase: count up + pulse + flurry.
    const start = performance.now();
    const duration = 600;
    cancelAnimationFrame(rafRef.current);
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    rafRef.current = requestAnimationFrame(tick);

    setPulsing(true);
    const id = window.setTimeout(() => setPulsing(false), 600);
    flurry(elRef.current);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(id);
    };
  }, [value]);

  return (
    <p
      ref={elRef}
      className={`origin-left text-5xl font-black leading-none text-white transition-transform duration-300 ${
        pulsing ? "scale-110 drop-shadow-[0_0_16px_rgba(212,175,55,0.85)]" : ""
      }`}
    >
      {display.toLocaleString()}
    </p>
  );
}
