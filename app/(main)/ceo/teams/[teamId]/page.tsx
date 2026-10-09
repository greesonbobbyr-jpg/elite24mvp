import Link from "next/link";
import { notFound } from "next/navigation";
import { recordAudit, teamDetail } from "@/lib/data/ceo";
import { requireCeo } from "../../gate";
import { roleLabel } from "@/lib/format";
import { cardDefault } from "@/app/components/ui/Card";
import { chipClass } from "@/app/components/ui/Pill";
import { StarIcon } from "@/app/components/ui/StatTile";

// CEO View · one team: staff and the roster with each player's card numbers
// and today's check-in status (done / not — never what they wrote).
export default async function CeoTeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const ceo = await requireCeo();
  const id = Number.parseInt((await params).teamId, 10);
  if (!Number.isInteger(id)) notFound();
  const team = await teamDetail(ceo, id);
  if (!team) notFound();
  await recordAudit(ceo, "ceo.view_team", {
    organizationId: team.organization?.id ?? null,
    teamId: team.id,
    detail: team.name,
  });
  const checkedIn = team.players.filter((p) => p.checkedInToday).length;

  return (
    <section className="flex flex-col gap-3">
      {team.organization && (
        <Link href={`/ceo/orgs/${team.organization.id}`} className="text-xs font-semibold text-brand">
          ← {team.organization.name}
        </Link>
      )}
      <div>
        <h2 className="text-xl font-black text-ink">{team.name}</h2>
        <p className="text-xs text-subtle">
          {team.players.length} players · {checkedIn} checked in today
        </p>
      </div>

      <div className={`${cardDefault} p-4`}>
        <h3 className="e24-eyebrow">Staff</h3>
        {team.staff.length === 0 && <p className="mt-2 text-sm text-muted">No staff yet.</p>}
        <ul className="mt-2 flex flex-col divide-y divide-line">
          {team.staff.map((s) => (
            <li key={s.profileId}>
              <Link href={`/ceo/people/${s.profileId}`} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate text-sm font-semibold text-ink">{s.name}</span>
                <span className={chipClass("accent")}>{roleLabel(s.role)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className={`${cardDefault} p-4`}>
        <h3 className="e24-eyebrow">Roster</h3>
        {team.players.length === 0 && <p className="mt-2 text-sm text-muted">No players yet.</p>}
        <ul className="mt-2 flex flex-col divide-y divide-line">
          {team.players.map((p) => (
            <li key={p.profileId}>
              <Link href={`/ceo/people/${p.profileId}`} className="flex items-center gap-3 py-2">
                <span className="w-8 shrink-0 text-center font-mono text-xs text-subtle">
                  {p.jerseyNumber != null ? `#${p.jerseyNumber}` : ""}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                  {/* Each piece stays whole when the line wraps. */}
                  <span className="flex flex-wrap items-center gap-x-1 text-xs text-subtle">
                    <span className="flex text-gold-solid" aria-label={`${p.stars} stars`}>
                      {Array.from({ length: p.stars }, (_, i) => (
                        <StarIcon key={i} className="h-3 w-3" />
                      ))}
                    </span>
                    <span className="whitespace-nowrap">· {p.teamPoints.toLocaleString()} pts this season</span>
                    <span className="whitespace-nowrap">· 🔥 {p.streak}</span>
                  </span>
                </span>
                <span className={chipClass(p.checkedInToday ? "good" : "neutral")}>
                  {p.checkedInToday ? "Checked in" : "Not yet"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-subtle">🔒 Journals and reflections stay private to each player.</p>
    </section>
  );
}
