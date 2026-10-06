// Pills, chips and small solid marks (CLAUDE.md §9: selected = a solid accent
// fill; status is solid too — never a see-through tint).

/** A selectable pill (tabs like All-time / This week, Manage / Browse, the
 * Pro Review outcome, Add / Remove): solid accent when selected, white with a
 * gray outline otherwise. */
export function pillClass(selected: boolean, size: "sm" | "md" = "md") {
  const pad = size === "sm" ? "px-3 py-1 text-[11px]" : "px-4 py-1.5 text-xs";
  return `inline-flex items-center justify-center rounded-full border font-bold uppercase tracking-wide transition active:scale-95 ${pad} ${
    selected
      ? "border-accent-edge bg-accent text-on-accent"
      : "border-line-strong bg-panel text-ink-mid hover:border-field-line hover:text-ink"
  }`;
}

type Tone = "accent" | "good" | "warn" | "gold" | "neutral";

const TONES: Record<Tone, string> = {
  accent: "bg-accent text-on-accent",
  good: "bg-good-solid text-on-accent",
  warn: "bg-warn-solid text-on-gold",
  gold: "bg-gold-solid text-on-gold",
  neutral: "border border-line-strong bg-raised-2 text-ink-mid",
};

/** A small solid badge: role tags, "✓ Checked in", quest chips, TIME OUT. */
export function chipClass(tone: Tone = "neutral") {
  return `inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`;
}

/** A solid square icon tile (quest icons). */
export const iconTile = "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-on-accent";
