"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logout } from "./auth-actions";

type NavLink = { href: string; label: string };

// Top-right hamburger menu. Pure styling + open/close behavior — it just renders
// whatever links it's given (the routing targets are decided by the caller).
export function NavMenu({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
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
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-black text-white transition hover:border-red-500 hover:text-red-400 active:scale-95"
      >
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
        <nav className="e24-reveal absolute right-0 z-50 mt-2 w-52 origin-top-right overflow-hidden rounded-xl border border-zinc-800 bg-black shadow-xl shadow-black/40">
          {links.map((link) => (
            <Link
              key={link.href + link.label}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm font-medium text-white transition hover:bg-red-600/20 hover:text-red-400"
            >
              {link.label}
            </Link>
          ))}
          <form action={logout} className="border-t border-zinc-800">
            <button
              type="submit"
              className="block w-full px-4 py-3 text-left text-sm font-medium text-zinc-400 transition hover:bg-red-600/20 hover:text-red-400"
            >
              Log out
            </button>
          </form>
        </nav>
      )}
    </div>
  );
}
