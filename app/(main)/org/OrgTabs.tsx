import Link from "next/link";
import { pillClass } from "@/app/components/ui/Pill";

// Manage | Browse — the org admin's two views of their organization.
export function OrgTabs({ current }: { current: "manage" | "browse" }) {
  const tabs = [
    { key: "manage", href: "/org", label: "Manage" },
    { key: "browse", href: "/org/view", label: "Browse" },
  ] as const;
  return (
    <nav aria-label="Organization views" className="flex gap-2">
      {tabs.map((tab) =>
        tab.key === current ? (
          <span
            key={tab.key}
            aria-current="page"
            className={pillClass(true)}
          >
            {tab.label}
          </span>
        ) : (
          <Link
            key={tab.key}
            href={tab.href}
            className={pillClass(false)}
          >
            {tab.label}
          </Link>
        ),
      )}
    </nav>
  );
}
