import Link from "next/link";
import { notFound } from "next/navigation";
import { orgDetail, recordAudit } from "@/lib/data/ceo";
import { requireCeo } from "../../gate";
import { cardDefault } from "@/app/components/ui/Card";
import { chipClass } from "@/app/components/ui/Pill";

// CEO View · one organization: its admins and every team. Opening it is
// recorded (AuditEvent) for the organization's own Activity.
export default async function CeoOrgPage({ params }: { params: Promise<{ orgId: string }> }) {
  const ceo = await requireCeo();
  const id = Number.parseInt((await params).orgId, 10);
  if (!Number.isInteger(id)) notFound();
  const org = await orgDetail(ceo, id);
  if (!org) notFound();
  await recordAudit(ceo, "ceo.view_org", { organizationId: org.id, detail: org.name });

  return (
    <section className="flex flex-col gap-3">
      <Link href="/ceo/orgs" className="text-xs font-semibold text-brand">← Organizations</Link>
      <div>
        <h2 className="text-xl font-black text-ink">{org.name}</h2>
        <p className="text-xs text-subtle">
          Since {org.createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" })} ·{" "}
          {org.teams.length} {org.teams.length === 1 ? "team" : "teams"}
        </p>
      </div>
      {org.admins.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted">Org admins:</span>
          {org.admins.map((a) => (
            <Link key={a.id} href={`/ceo/people/${a.id}`} className={chipClass("accent")}>{a.name}</Link>
          ))}
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {org.teams.map((t) => (
          <li key={t.id}>
            <Link href={`/ceo/teams/${t.id}`} className={`${cardDefault} flex items-center gap-3 p-3`}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{t.name}</span>
                <span className="block truncate text-xs text-subtle">
                  {t.headCoaches.length > 0 ? `Head coach: ${t.headCoaches.join(", ")}` : "No head coach yet"} ·{" "}
                  {t.players} players · {t.staff} staff
                </span>
              </span>
              <span className="text-xs font-semibold text-brand">Open →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
