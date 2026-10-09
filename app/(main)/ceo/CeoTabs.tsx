"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { pillClass } from "@/app/components/ui/Pill";

const TABS = [
  { href: "/ceo", label: "Overview" },
  { href: "/ceo/orgs", label: "Orgs" },
  { href: "/ceo/people", label: "People" },
  { href: "/ceo/activity", label: "Activity" },
] as const;

export function CeoTabs() {
  const pathname = usePathname();
  // Team pages live under an organization, so they light up Organizations.
  const active = (href: string) =>
    href === "/ceo"
      ? pathname === "/ceo"
      : pathname.startsWith(href) || (href === "/ceo/orgs" && pathname.startsWith("/ceo/teams"));
  return (
    <nav aria-label="CEO View" className="flex flex-wrap gap-1.5">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={active(t.href) ? "page" : undefined}
          className={pillClass(active(t.href), "sm")}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
