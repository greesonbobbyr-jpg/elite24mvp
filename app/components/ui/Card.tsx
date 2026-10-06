import type { HTMLAttributes } from "react";

// Shared card surface primitive. Pure styling — spreads native <div> props and
// carries no behavior. Every surface has a visible edge in both modes
// (CLAUDE.md §9). The class strings are also exported so interactive
// components (e.g. MindsetCard, whose outer element is a <button>/<section>)
// can match the exact surface without nesting a <div>.

/** A neutral card: white on the light page, near-black on the dark one. */
export const cardDefault = "rounded-xl border border-line bg-panel p-5 shadow-sm shadow-shade";
/** An accent-marked surface: neutral, plus a solid accent bar down its left
 * edge (never a tinted wash). `stripAccent` has no padding (one-line strips). */
export const stripAccent =
  "relative overflow-hidden rounded-xl border border-line bg-panel shadow-sm shadow-shade before:absolute before:inset-y-0 before:left-0 before:w-1.5 before:bg-accent";
export const cardAccent = `${stripAccent} p-5 pl-6`;
/** Premium brand "material" surface (`.e24-surface` in globals.css: its own
 * edge, court arcs and, in dark, the red glow). Reusable across the app. */
export const cardMaterial = "e24-surface rounded-2xl p-6";
/** A row nested inside a card (a list item, a quoted note). */
export const rowNested = "rounded-lg border border-line bg-sunken";
/** A row sitting directly on the page (a list of alerts, roster entries). */
export const rowOnPage = "rounded-xl border border-line bg-panel";

type Variant = "default" | "accent" | "material";

const SURFACES: Record<Variant, string> = {
  default: cardDefault,
  accent: cardAccent,
  material: cardMaterial,
};

export function Card({
  variant = "default",
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  return <div className={`${SURFACES[variant]} ${className}`} {...props} />;
}
