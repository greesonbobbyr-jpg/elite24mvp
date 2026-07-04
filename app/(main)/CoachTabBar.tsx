"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Coach-only bottom tab bar: Home / Team Circle / Alerts. A faithful mirror of
// PlayerTabBar (same shell, active-glow, z-40, safe-area) with the coach tab set,
// so coaches finally get one-tap Home. Navigation UI only — no logic/data.
// Icons are embedded MDI paths (Apache-2.0, currentColor + 24x24).

function IconHome({ className }: { className?: string }) {
  // MDI "home"
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z" />
    </svg>
  );
}

function IconChat({ className }: { className?: string }) {
  // MDI "message" (chat bubble)
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M20,2H4C2.9,2 2,2.9 2,4V22L6,18H20C21.1,18 22,17.1 22,16V4C22,2.9 21.1,2 20,2Z" />
    </svg>
  );
}

function IconBell({ className }: { className?: string }) {
  // MDI "bell"
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M21,19V20H3V19L5,17V11C5,7.9 7.03,5.17 10,4.29C10,4.19 10,4.1 10,4A2,2 0 0,1 12,2A2,2 0 0,1 14,4C14,4.1 14,4.19 14,4.29C16.97,5.17 19,7.9 19,11V17L21,19M14,21A2,2 0 0,1 12,23A2,2 0 0,1 10,21H14Z" />
    </svg>
  );
}

const TABS = [
  { href: "/", label: "Home", Icon: IconHome },
  { href: "/board", label: "Team Circle", Icon: IconChat },
  { href: "/notifications", label: "Alerts", Icon: IconBell },
] as const;

function isTabActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CoachTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-red-600/25 bg-gradient-to-b from-zinc-950 to-black pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.5)]"
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map(({ href, label, Icon }) => {
          const active = isTabActive(href, pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-0.5 py-2.5 transition active:scale-95 ${
                  active ? "text-red-500" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute top-0 h-0.5 w-8 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]"
                  />
                )}
                <Icon className="h-6 w-6" />
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide ${
                    active ? "text-red-400" : "text-zinc-500"
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
