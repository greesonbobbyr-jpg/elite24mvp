import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/lib/context";
import { adminOrgIds } from "@/lib/orgaccess";
import { cardDefault } from "@/app/components/ui/Card";

// ☰ "Organization View": straight into the organization this person runs, or
// a picker when they run more than one. The CEO opens organizations from
// CEO View instead.
export default async function OrgIndexPage() {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/");
  const ids = adminOrgIds(ctx);
  if (ids.length === 0) redirect(ctx.platformRole === "CEO" ? "/ceo/orgs" : "/");
  if (ids.length === 1) redirect(`/org/${ids[0]}`);

  const orgs = await prisma.organization.findMany({
    where: { id: { in: ids } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-5 py-6">
      <header>
        <p className="e24-eyebrow">Organization View</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-ink">Pick an organization</h1>
      </header>
      {orgs.map((o) => (
        <Link key={o.id} href={`/org/${o.id}`} className={`${cardDefault} flex items-center justify-between p-4`}>
          <span className="truncate font-semibold text-ink">{o.name}</span>
          <span className="text-xs font-semibold text-brand">Open →</span>
        </Link>
      ))}
    </main>
  );
}
