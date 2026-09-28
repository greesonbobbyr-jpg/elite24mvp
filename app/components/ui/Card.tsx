import type { HTMLAttributes } from "react";

// Shared card surface primitive. Pure styling — spreads native <div> props and
// carries no behavior. Two on-brand variants: a neutral panel and a red-tinted
// accent (a faint brand-red wash: near-black red on the dark page, pale pink on
// light). The class strings are also exported so interactive components (e.g.
// MindsetCard, whose outer element is a <button>/<section>) can match the exact
// surface without nesting a <div>.

export const cardDefault = "rounded-xl border border-line bg-panel p-5";
export const cardAccent = "rounded-xl border border-red-600/40 bg-red-600/[0.04] p-5";
// Premium brand "material" surface (gradient + red glow + court arcs + sheen,
// defined as `.e24-surface` in globals.css). Reusable across the app.
export const cardMaterial = "e24-surface rounded-2xl border border-red-600/30 p-6";

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
