import Link from "next/link";
import { listOrganizations } from "@/lib/data/ceo";
import { cardDefault } from "@/app/components/ui/Card";
import { fieldClass } from "@/app/components/ui/Field";

// CEO View · Organizations — every org, searchable by name.
export default async function CeoOrgsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const orgs = await listOrganizations(q.trim());
  return (
    <section className="flex flex-col gap-2">
      <form role="search" className="flex gap-2">
        <label htmlFor="ceo-org-q" className="sr-only">Search organizations</label>
        <input id="ceo-org-q" name="q" defaultValue={q} placeholder="Search organizations" className={fieldClass} />
      </form>
      {orgs.length === 0 && <p className="px-1 py-4 text-sm text-muted">No organizations match.</p>}
      {orgs.map((o) => (
        <Link key={o.id} href={`/ceo/orgs/${o.id}`} className={`${cardDefault} flex items-center gap-3 p-3`}>
          {o.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={o.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-frame object-contain p-1" />
          ) : (
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-frame text-sm font-black text-logo">
              {o.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-ink">{o.name}</span>
            <span className="block text-xs text-subtle">
              {o.teams} {o.teams === 1 ? "team" : "teams"} · {o.players} players · {o.staff} staff
            </span>
          </span>
          <span className="text-xs font-semibold text-brand">Open →</span>
        </Link>
      ))}
    </section>
  );
}
