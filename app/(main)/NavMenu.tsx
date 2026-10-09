"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "./auth-actions";
import { THEME_COOKIE, parseTheme, type ThemeChoice } from "@/lib/theme";

const THEME_OPTIONS: { value: ThemeChoice; label: string; title: string }[] = [
  { value: "system", label: "Auto", title: "Match my phone's setting" },
  { value: "light", label: "Light", title: "Always light" },
  { value: "dark", label: "Dark", title: "Always dark" },
];

// Switches instantly (no reload) and remembers the choice on this device; the
// server reads the same cookie to render the next page (app/layout.tsx).
function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") {
    root.removeAttribute("data-theme");
    document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
  } else {
    root.setAttribute("data-theme", choice);
    document.cookie = `${THEME_COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax`;
  }
}

type NavLink = { href: string; label: string };

// Top-right hamburger menu. Pure styling + open/close behavior — it just renders
// whatever links it's given (the routing targets are decided by the caller).
// `loginName` is what this person types to log in, shown so nobody has to
// guess (players rarely see their username anywhere else). `unread` puts a
// number on the button so new alerts are noticed from any page.
export function NavMenu({
  links,
  loginName,
  unread = 0,
}: {
  links: NavLink[];
  loginName?: string | null;
  unread?: number;
}) {
  const [open, setOpen] = useState(false);
  // Read from <html data-theme> (set server-side). The picker only renders
  // once the menu is open, so the server's "system" default never shows.
  const [theme, setTheme] = useState<ThemeChoice>(() =>
    typeof document === "undefined"
      ? "system"
      : parseTheme(document.documentElement.getAttribute("data-theme")),
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={unread > 0 ? `Menu, ${unread} unread` : "Menu"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-frame text-ink transition hover:border-accent-edge hover:text-brand-2 active:scale-95"
      >
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-frame bg-accent px-1 text-[11px] font-black leading-none text-on-accent"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="2" y1="5" x2="16" y2="5" />
          <line x1="2" y1="9" x2="16" y2="9" />
          <line x1="2" y1="13" x2="16" y2="13" />
        </svg>
      </button>

      {open && (
        <nav className="e24-reveal absolute right-0 z-50 mt-2 w-52 origin-top-right overflow-hidden rounded-xl border border-line bg-frame shadow-xl shadow-shade">
          {loginName && (
            <p className="border-b border-line px-4 py-2.5 text-xs text-subtle">
              Signed in as{" "}
              <span className="break-all font-semibold text-ink-mid">{loginName}</span>
            </p>
          )}
          {links.map((link) => (
            <Link
              key={link.href + link.label}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm font-medium text-ink transition hover:bg-raised hover:text-brand-2"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/account/password"
            onClick={() => setOpen(false)}
            className="block border-t border-line px-4 py-3 text-sm font-medium text-muted transition hover:bg-raised hover:text-brand-2"
          >
            Change password
          </Link>
          <div className="border-t border-line px-4 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">
              Appearance
            </p>
            <div role="radiogroup" aria-label="Appearance" className="grid grid-cols-3 gap-1 rounded-lg bg-raised p-1">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={theme === option.value}
                  title={option.title}
                  onClick={() => {
                    applyTheme(option.value);
                    setTheme(option.value);
                  }}
                  className={`rounded-md px-2 py-1.5 text-xs font-semibold transition ${
                    theme === option.value ? "bg-accent text-on-accent" : "text-muted hover:text-ink"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <form action={logout} className="border-t border-line">
            <button
              type="submit"
              className="block w-full px-4 py-3 text-left text-sm font-medium text-muted transition hover:bg-raised hover:text-brand-2"
            >
              Log out
            </button>
          </form>
        </nav>
      )}
    </div>
  );
}
