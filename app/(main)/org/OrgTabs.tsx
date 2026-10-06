import Link from "next/link";

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
            className="rounded-full border border-brand bg-brand/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-3"
          >
            {tab.label}
          </span>
        ) : (
          <Link
            key={tab.key}
            href={tab.href}
            className="rounded-full border border-line-strong px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-muted transition hover:border-field-line"
          >
            {tab.label}
          </Link>
        ),
      )}
    </nav>
  );
}
