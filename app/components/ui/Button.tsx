import type { ButtonHTMLAttributes } from "react";

// Shared button primitive. Pure styling — it spreads every native <button> prop
// (type, disabled, onClick, aria-*, formAction), so it carries no behavior of its
// own and works in both server and client components. The accent is always
// solid (CLAUDE.md §9): a disabled button turns solid gray, never see-through.
// `buttonClass` gives a <Link> or <a> the same look.
type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition active:scale-[0.97] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-edge focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent shadow-sm shadow-shade hover:bg-accent-hover disabled:bg-raised-3 disabled:text-muted disabled:shadow-none",
  secondary:
    "border border-line-strong bg-panel text-ink hover:border-field-line hover:bg-sunken disabled:text-subtle",
  ghost: "text-ink-mid hover:bg-sunken hover:text-ink disabled:text-subtle",
  danger:
    "border border-accent-edge bg-panel text-brand hover:bg-accent hover:text-on-accent disabled:border-line-strong disabled:text-subtle",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md") {
  return `${base} ${variants[variant]} ${sizes[size]}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return <button className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}
