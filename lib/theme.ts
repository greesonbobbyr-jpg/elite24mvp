// Appearance: follow the phone's setting ("system", the default) or pin light
// or dark. The choice lives in a cookie on this device only — no account data
// — so the server can render <html data-theme> directly and the page never
// flashes the wrong mode. Colors themselves are in app/globals.css.

export const THEME_COOKIE = "e24_theme";

export type ThemeChoice = "system" | "light" | "dark";

export function parseTheme(value: string | null | undefined): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}
