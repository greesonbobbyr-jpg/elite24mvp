import Link from "next/link";
import type { ReactNode } from "react";

// The app's frame for mockup screens: the black brand header (wordmark,
// avatar, ☰ with the unread number) and an optional bottom tab bar. Mirrors
// app/(main)/layout.tsx without touching the real one.

export function MockShell({
  badge = 0,
  initials = "JC",
  tabs,
  active,
  wide = false,
  children,
}: {
  /** Unread notifications + announcements: the number on ☰. */
  badge?: number;
  initials?: string;
  tabs?: "player" | "coach" | "personal";
  active?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const tabSets: Record<string, string[]> = {
    player: ["Home", "Team Circle", "Quests"],
    coach: ["Home", "Team Circle", "Alerts"],
    personal: ["Home", "Quests", "Journal"],
  };
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="theme-dark border-b border-line-faint bg-frame px-3 pb-2.5 pt-2.5">
        <div className="relative flex items-center justify-between">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-line-strong bg-raised text-xs font-black text-ink">
            {initials}
          </span>
          <div
            role="img"
            aria-label="Elite24MVP"
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-black italic leading-none text-ink"
            style={{ fontFamily: "var(--font-barlow)", fontSize: "1.25rem" }}
          >
            Elite<span className="text-logo">24</span>MVP
          </div>
          <Link
            href="/preview/notifications"
            aria-label={badge ? `Menu, ${badge} unread` : "Menu"}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-frame text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <line x1="2" y1="5" x2="16" y2="5" />
              <line x1="2" y1="9" x2="16" y2="9" />
              <line x1="2" y1="13" x2="16" y2="13" />
            </svg>
            {badge > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-frame bg-accent px-1 text-[11px] font-black leading-none text-on-accent">
                {badge > 9 ? "9+" : badge}
              </span>
            )}
          </Link>
        </div>
      </header>
      <main className={`mx-auto flex w-full flex-1 flex-col gap-5 px-5 py-6 ${wide ? "max-w-3xl" : "max-w-xl"} ${tabs ? "pb-28" : ""}`}>
        {children}
      </main>
      {tabs && (
        <nav className="theme-dark fixed inset-x-0 bottom-0 z-40 border-t border-line bg-gradient-to-b from-canvas to-frame">
          <ul className="mx-auto flex max-w-xl">
            {tabSets[tabs].map((t) => (
              <li key={t} className="flex-1">
                <span className={`relative flex flex-col items-center gap-0.5 py-3 text-[10px] font-semibold uppercase tracking-wide ${t === active ? "text-brand-2" : "text-subtle"}`}>
                  {t === active && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />}
                  <span aria-hidden className="h-5 w-5 rounded-md bg-current opacity-60" />
                  {t}
                  {t === "Alerts" && badge > 0 && (
                    <span className="absolute right-1/2 top-1.5 -mr-5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-black text-on-accent">
                      {badge}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

/** The sign-in pages' centered frame (no header), as on /login today. */
export function AuthFrame({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6 py-10">
      <div className="text-center">
        <span className="text-2xl font-black italic tracking-tight text-ink" style={{ fontFamily: "var(--font-barlow)" }}>
          Elite<span className="text-logo">24</span>MVP
        </span>
        <p className="mt-2 text-sm text-subtle">{subtitle}</p>
      </div>
      {children}
    </main>
  );
}

/** A small "mockup" note so it's never mistaken for the real thing. */
export function MockNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-line-strong bg-sunken px-3 py-2 text-xs text-muted">
      <span className="font-bold uppercase tracking-wide text-brand">Mockup · </span>
      {children}
    </p>
  );
}
