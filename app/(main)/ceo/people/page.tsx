import Link from "next/link";
import { searchPeople } from "@/lib/data/ceo";
import { requireCeo } from "../gate";
import { roleLabel } from "@/lib/format";
import { cardDefault } from "@/app/components/ui/Card";
import { fieldClass } from "@/app/components/ui/Field";

// CEO View · People — find anyone by name, email or username.
export default async function CeoPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ceo = await requireCeo();
  const { q = "" } = await searchParams;
  const people = await searchPeople(ceo, q);
  return (
    <section className="flex flex-col gap-2">
      <form role="search">
        <label htmlFor="ceo-people-q" className="sr-only">Search people</label>
        <input id="ceo-people-q" name="q" defaultValue={q} placeholder="Search by name, email or username" className={fieldClass} />
      </form>
      {q.trim().length < 2 ? (
        <p className="px-1 py-4 text-sm text-muted">Type at least two letters to search.</p>
      ) : people.length === 0 ? (
        <p className="px-1 py-4 text-sm text-muted">Nobody matches “{q}”.</p>
      ) : (
        people.map((p) => (
          <Link key={p.id} href={`/ceo/people/${p.id}`} className={`${cardDefault} flex items-center gap-3 p-3`}>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-ink">{p.name}</span>
              <span className="block truncate text-xs text-subtle">
                {[p.login, ...p.teams.map((t) => `${roleLabel(t.role) ?? "Player"} · ${t.team}`)]
                  .filter(Boolean)
                  .join(" · ") || "No team"}
              </span>
            </span>
            <span className="text-xs font-semibold text-brand">Open →</span>
          </Link>
        ))
      )}
    </section>
  );
}
