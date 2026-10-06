import type { HTMLAttributes } from "react";

// A status banner: a neutral card with a solid colored bar down its left edge
// and dark text (CLAUDE.md §9 — status is solid, never a see-through wash).
type Tone = "accent" | "warn" | "good" | "info";

const BARS: Record<Tone, string> = {
  accent: "border-l-accent",
  warn: "border-l-warn-solid",
  good: "border-l-good-solid",
  info: "border-l-info",
};

export function bannerClass(tone: Tone = "warn") {
  return `rounded-xl border border-line border-l-4 bg-panel px-4 py-3 text-sm font-semibold text-ink shadow-sm shadow-shade ${BARS[tone]}`;
}

export function Banner({
  tone = "warn",
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return <div className={`${bannerClass(tone)} ${className}`} {...props} />;
}
