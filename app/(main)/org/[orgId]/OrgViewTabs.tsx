"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { pillClass } from "@/app/components/ui/Pill";

// Tree | Structure | People | Activity — Activity is the whole org's record,
// so a group admin (one branch) doesn't get it.
export function OrgViewTabs({ orgId, showActivity }: { orgId: number; showActivity: boolean }) {
  const pathname = usePathname();
  const base = `/org/${orgId}`;
  const tabs = [
    { href: base, label: "Tree" },
    { href: `${base}/structure`, label: "Structure" },
    { href: `${base}/people`, label: "People" },
    ...(showActivity ? [{ href: `${base}/activity`, label: "Activity" }] : []),
  ];
  return (
    <nav aria-label="Organization View" className="flex flex-wrap gap-1.5">
      {tabs.map((t) => {
        const active = t.href === base ? pathname === base : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={active ? "page" : undefined} className={pillClass(active, "sm")}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
