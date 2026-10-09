import type { ReactNode } from "react";

// A stat tile (the home progress strip): the value centered in the tile, its
// label pinned to the bottom center, every tile the same height — so a value
// never crowds the top edge and the labels line up (owner, 2026-10-09).
export function StatTile({
  label,
  ariaLabel,
  children,
}: {
  label: ReactNode;
  /** What a screen reader hears, when the value is icons (the stars). */
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      className="flex h-[88px] flex-col items-center rounded-xl border border-line bg-panel px-1.5 pb-2 pt-2 text-center shadow-sm shadow-shade"
    >
      <div className="flex w-full flex-1 flex-col items-center justify-center">{children}</div>
      <p className="w-full text-[9px] font-bold uppercase leading-tight tracking-[0.12em] text-subtle">
        {label}
      </p>
    </div>
  );
}

/** A solid gold star (the card's TIER stars), as an icon, not a glyph. */
export function StarIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={`fill-current ${className}`}>
      <path d="M12 2.6l2.9 6.1 6.7.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.3 1.3-6.6-4.9-4.6 6.7-.8z" />
    </svg>
  );
}
