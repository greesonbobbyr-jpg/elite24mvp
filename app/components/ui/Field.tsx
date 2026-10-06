// Shared form-field styling (one copy instead of one per form). White fields
// with a gray outline that passes WCAG non-text contrast; focus is a solid
// accent outline (CLAUDE.md §9). Add padding/size tweaks with extra classes.

export const fieldClass =
  "w-full rounded-lg border border-field-line bg-field px-3 py-2 text-sm text-ink outline-none transition focus:border-accent-edge focus:ring-1 focus:ring-accent-edge disabled:bg-sunken disabled:text-subtle";

export const labelClass = "mb-1 block text-xs font-medium text-muted";

/** A checkbox or radio in the accent. */
export const checkClass = "h-4 w-4 accent-accent";
